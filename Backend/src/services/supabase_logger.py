import os
from typing import Any, Dict, Optional

import httpx


async def log_interaction(
    route: str,
    input_payload: Dict[str, Any],
    output_payload: Dict[str, Any],
    model: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Persist an LLM interaction to Supabase REST API.

    This is best-effort: it silently returns on misconfiguration or errors.
    Configure the following env vars:
      - SUPABASE_URL: e.g. https://<project>.supabase.co
      - SUPABASE_SERVICE_ROLE (preferred) or SUPABASE_ANON_KEY
      - SUPABASE_TABLE (default: llm_interactions)
    Table is expected to support JSONB columns for input/output.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE") or os.getenv("SUPABASE_ANON_KEY")
    table = os.getenv("SUPABASE_TABLE", "llm_interactions")

    # Do not block main flow if not configured
    if not supabase_url or not supabase_key or not table:
        return

    endpoint = supabase_url.rstrip("/") + f"/rest/v1/{table}"

    # Build row
    payload: Dict[str, Any] = {
        "route": route,
        "model": model or os.getenv("GROQ_MODEL"),
        "input": input_payload,
        "output": output_payload,
    }
    if extra:
        payload.update(extra)

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        # return inserted row; safe to ignore
        "Prefer": "return=representation",
    }

    # Best-effort insert; swallow exceptions
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            await client.post(endpoint, headers=headers, json=payload)
    except Exception:
        # Intentionally ignore logging failures
        return


async def fetch_interactions(
    route: str,
    limit: int = 20,
    offset: int = 0,
    select: str = "*",
):
    """Fetch interactions from Supabase REST API for a given route.

    Returns a list of rows (dict). Best-effort: returns [] on error/misconfig.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE") or os.getenv("SUPABASE_ANON_KEY")
    table = os.getenv("SUPABASE_TABLE", "llm_interactions")

    if not supabase_url or not supabase_key or not table:
        return []

    endpoint = supabase_url.rstrip("/") + f"/rest/v1/{table}"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Accept": "application/json",
    }

    params = {
        "select": select,
        "route": f"eq.{route}",
        "order": "created_at.desc",
        "limit": str(max(0, min(1000, limit))),
        "offset": str(max(0, offset)),
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(endpoint, headers=headers, params=params)
            if r.status_code >= 200 and r.status_code < 300:
                return r.json()
    except Exception:
        pass
    return []


async def delete_interaction_by_id(row_id: str) -> int:
    """Delete a single interaction row by id.

    Returns number of deleted rows (0 or 1). Best-effort: returns 0 on error/misconfig.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE") or os.getenv("SUPABASE_ANON_KEY")
    table = os.getenv("SUPABASE_TABLE", "llm_interactions")

    if not supabase_url or not supabase_key or not table or not row_id:
        return 0

    endpoint = supabase_url.rstrip("/") + f"/rest/v1/{table}"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Accept": "application/json",
        # Return deleted rows so we can count them
        "Prefer": "return=representation",
    }
    params = {
        "id": f"eq.{row_id}",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.delete(endpoint, headers=headers, params=params)
            if r.status_code >= 200 and r.status_code < 300:
                try:
                    data = r.json()
                    if isinstance(data, list):
                        return len(data)
                except Exception:
                    # If minimal/no body, infer success (but cannot confirm count)
                    return 1
    except Exception:
        pass
    return 0
