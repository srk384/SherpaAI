import os
import json
from typing import Any, Dict, Optional

from fastapi import HTTPException, Request
from urllib.parse import quote
import httpx
from urllib.parse import urlparse
import ipaddress
from dotenv import load_dotenv

# Try to import the official Upstash QStash SDK.
try:
    from upstash_qstash import QStash as _QStash  # type: ignore
except Exception:  # pragma: no cover - tolerate missing SDK during local editing
    try:
        # Fallback if some environments expose it under a different top-level name
        from qstash import QStash as _QStash  # type: ignore
    except Exception:
        _QStash = None  # type: ignore

# Receiver is optional; only used for request verification if available
try:
    from upstash_qstash import Receiver as _Receiver  # type: ignore
except Exception:  # pragma: no cover
    try:
        from qstash import Receiver as _Receiver  # type: ignore
    except Exception:
        _Receiver = None  # type: ignore

load_dotenv()

def get_qstash_client():
    """Return an initialized QStash client using QSTASH_TOKEN.

    Raises HTTPException(500) if the token or SDK is not available.
    """
    token = os.getenv("QSTASH_TOKEN")
    if not token:
        raise HTTPException(status_code=500, detail="QSTASH_TOKEN not configured")
    if _QStash is None:
        # SDK not installed; return None and rely on HTTP fallback
        return None
    # Some SDK variants expect positional vs keyword; support both
    try:
        return _QStash(token=token)  # type: ignore[arg-type]
    except TypeError:
        return _QStash(token)  # type: ignore[call-arg]


def qstash_publish_json(client: Any, url: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Publish a JSON message to QStash, handling slight SDK API variations.

    Returns a response dict that contains at least a 'messageId' key when available.
    """
    # Prefer JSON helpers when available
    if hasattr(client, "message") and hasattr(client.message, "publish_json"):
        resp = client.message.publish_json(url=url, body=body)
    elif hasattr(client, "publish_json"):
        resp = client.publish_json(url=url, body=body)
    elif hasattr(client, "publish"):
        # Generic publish, ensure JSON body
        payload = json.dumps(body)
        try:
            resp = client.publish(url=url, body=payload, content_type="application/json")
        except TypeError:
            # Older variants may use different param names
            resp = client.publish(url=url, body=payload)
    else:
        # Fallback to direct HTTP publish via QStash REST API using header forwarding.
        # This avoids ambiguity around URL encoding in the path and works reliably.
        token = os.getenv("QSTASH_TOKEN")
        if not token:
            raise HTTPException(status_code=500, detail="QSTASH_TOKEN not configured")
        publish_url = "https://qstash.upstash.io/v2/publish"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Upstash-Forward-Url": url,
        }
        with httpx.Client(timeout=30.0) as client_http:
            resp = client_http.post(publish_url, headers=headers, json=body)
            if resp.status_code >= 400:
                raise HTTPException(status_code=500, detail=f"QStash publish failed: {resp.status_code} {resp.text}")
            try:
                resp_json = resp.json()
            except Exception:
                resp_json = {"raw": resp.text}
        # Normalize key
        if isinstance(resp_json, dict) and "messageId" not in resp_json and "message_id" in resp_json:
            resp_json["messageId"] = resp_json.get("message_id")
        return resp_json

    # Normalize response to a dict
    if isinstance(resp, dict):
        # Ensure consistent key for message id
        if "messageId" not in resp and "message_id" in resp:
            resp["messageId"] = resp.get("message_id")
        return resp
    try:
        # Some SDKs may return an object; try to access attributes
        message_id = getattr(resp, "messageId", None) or getattr(resp, "message_id", None)
        return {"messageId": message_id, "raw": resp}
    except Exception:
        return {"raw": resp}


async def verify_qstash_request(request: Request) -> None:
    """Verify that the incoming request is from QStash, if verification is configured.

    - Uses Receiver from the SDK when available.
    - Requires env var QSTASH_CURRENT_SIGNING_KEY (and optional QSTASH_NEXT_SIGNING_KEY).
    - If Receiver or keys are not present, this becomes a no-op for convenience during local dev.
    """
    if _Receiver is None:
        # SDK Receiver not available; skip verification (acceptable for local/dev)
        return

    current_key = os.getenv("QSTASH_CURRENT_SIGNING_KEY") or os.getenv("QSTASH_SIGNING_KEY")
    next_key = os.getenv("QSTASH_NEXT_SIGNING_KEY")
    if not current_key:
        # Not configured; skip verification
        return

    # Build receiver handling signature name variations across versions
    receiver: Optional[Any] = None
    for kwargs in (
        {"current_signing_key": current_key, "next_signing_key": next_key},
        {"signing_key": current_key},
    ):
        try:
            receiver = _Receiver(**{k: v for k, v in kwargs.items() if v})  # type: ignore[arg-type]
            break
        except Exception:
            continue
    if receiver is None:
        return

    signature = request.headers.get("upstash-signature") or request.headers.get("Upstash-Signature")
    if not signature:
        raise HTTPException(status_code=401, detail="Missing Upstash-Signature header")

    body = await request.body()
    url = str(request.url)

    # Verify may throw on failure; let it propagate as 401
    try:
        # Common signature: verify(signature=..., body=..., url=...)
        receiver.verify(signature=signature, body=body, url=url)  # type: ignore[attr-defined]
    except TypeError:
        # Some variants may expect bytes and path only
        receiver.verify(signature, body)  # type: ignore[misc]


def normalize_base_url(value: Optional[str]) -> str:
    """Ensure a base URL has a valid scheme and no trailing slash.

    - Adds http:// for localhost-like hosts
    - Adds https:// for other hosts if missing
    - Strips trailing slash
    """
    if not value or not value.strip():
        raise HTTPException(status_code=500, detail="BACKEND_URL not configured")
    v = value.strip().rstrip("/")
    # Strip surrounding single/double quotes to tolerate quoted .env entries
    if len(v) >= 2 and v[0] in ('"', "'") and v[-1] == v[0]:
        v = v[1:-1]
    if not (v.startswith("http://") or v.startswith("https://")):
        lower = v.lower()
        if lower.startswith("localhost") or lower.startswith("127.0.0.1") or lower.startswith("0.0.0.0"):
            v = f"http://{v}"
        else:
            v = f"https://{v}"
    return v


def build_callback_url(path: str) -> str:
    """Build a full callback URL from BACKEND_URL and the provided path."""
    base = normalize_base_url(os.getenv("BACKEND_URL"))
    if not path.startswith("/"):
        path = "/" + path
    return base + path


def is_loopback_or_private(url: str) -> bool:
    """Return True if URL resolves to localhost/loopback or private IP ranges.

    QStash rejects loopback/private destinations. For local development, use a
    tunnel and set BACKEND_URL to its public URL, or bypass QStash.
    """
    try:
        parsed = urlparse(url)
        host = parsed.hostname or ""
        if not host:
            return True
        # Treat common dev hosts as loopback
        if host in ("localhost", "ip6-localhost"):
            return True
        try:
            ip = ipaddress.ip_address(host)
            return ip.is_loopback or ip.is_private
        except ValueError:
            # Not an IP; leave as not private unless it's localhost
            return False
    except Exception:
        return True
