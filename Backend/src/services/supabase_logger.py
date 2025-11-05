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
    
    CRITICAL CHANGE: Now raises exceptions instead of silently failing.
    This ensures the caller (task processor) knows if logging failed and can retry.
    
    Configuration via environment variables:
      - SUPABASE_URL: e.g. https://<project>.supabase.co
      - SUPABASE_SERVICE_ROLE (preferred) or SUPABASE_ANON_KEY
      - SUPABASE_TABLE (default: llm_interactions)
    
    Table schema should support:
      - route: text (the API endpoint)
      - model: text (the LLM model used)
      - input: jsonb (input payload)
      - output: jsonb (output payload)
      - created_at: timestamp (auto-generated)
      - plus any additional columns from 'extra' dict
    
    Args:
        route: API endpoint path (e.g., "/api/v1/analyze-transcript")
        input_payload: Dictionary of input data sent to LLM
        output_payload: Dictionary of output/result from LLM
        model: Name of the LLM model used (defaults to GROQ_MODEL env var)
        extra: Optional additional fields to store (e.g., company, name)
    
    Raises:
        Exception: If Supabase is not configured or request fails
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE") or os.getenv("SUPABASE_ANON_KEY")
    table = os.getenv("SUPABASE_TABLE", "llm_interactions")

    # CRITICAL: Raise exception if not configured (instead of silent return)
    if not supabase_url:
        raise Exception("SUPABASE_URL environment variable is not set")
    if not supabase_key:
        raise Exception("SUPABASE_SERVICE_ROLE or SUPABASE_ANON_KEY environment variable is not set")
    if not table:
        raise Exception("SUPABASE_TABLE environment variable is not set")

    # Build REST API endpoint
    endpoint = supabase_url.rstrip("/") + f"/rest/v1/{table}"

    # Build row data to insert
    payload: Dict[str, Any] = {
        "route": route,
        "model": model or os.getenv("GROQ_MODEL"),
        "input": input_payload,
        "output": output_payload,
    }
    
    # Merge any additional fields
    if extra:
        payload.update(extra)

    # Set up authentication headers
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        # Request the inserted row back (useful for debugging, can be removed)
        "Prefer": "return=representation",
    }

    # CRITICAL: Propagate exceptions instead of swallowing them
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(endpoint, headers=headers, json=payload)
            
            # Check for HTTP errors
            if response.status_code >= 400:
                error_detail = response.text[:200]  # Truncate long error messages
                raise Exception(
                    f"Supabase insert failed with status {response.status_code}: {error_detail}"
                )
            
            print(f"[INFO] Successfully logged interaction to Supabase: {route}")
            
    except httpx.TimeoutException as e:
        raise Exception(f"Supabase request timed out: {str(e)}")
    except httpx.RequestError as e:
        raise Exception(f"Supabase request failed: {str(e)}")
    except Exception as e:
        # Re-raise with context
        raise Exception(f"Failed to log to Supabase: {str(e)}")


async def fetch_interactions(
    route: str,
    limit: int = 20,
    offset: int = 0,
    select: str = "*",
):
    """
    Fetch interactions from Supabase REST API for a given route.
    
    Uses Supabase query parameters to filter, sort, and paginate results:
    - Filters by exact route match
    - Orders by created_at descending (newest first)
    - Limits and offsets for pagination
    
    Args:
        route: API endpoint to filter by (e.g., "/api/v1/analyze-transcript")
        limit: Maximum number of records to return (capped at 1000, default: 20)
        offset: Number of records to skip for pagination (default: 0)
        select: Columns to return (default: "*" for all columns)
    
    Returns:
        List of interaction records (each as a dict), or empty list on error/misconfig.
        Each record contains: id, route, model, input, output, created_at, etc.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE") or os.getenv("SUPABASE_ANON_KEY")
    table = os.getenv("SUPABASE_TABLE", "llm_interactions")

    # Return empty list if not configured (best-effort read)
    if not supabase_url or not supabase_key or not table:
        print("[WARN] Supabase not configured, returning empty list")
        return []

    endpoint = supabase_url.rstrip("/") + f"/rest/v1/{table}"
    
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Accept": "application/json",
    }

    # Build query parameters for filtering, sorting, pagination
    params = {
        "select": select,
        "route": f"eq.{route}",  # Filter: route equals the provided value
        "order": "created_at.desc",  # Sort: newest first
        "limit": str(max(0, min(1000, limit))),  # Clamp between 0-1000
        "offset": str(max(0, offset)),  # Ensure non-negative
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(endpoint, headers=headers, params=params)
            
            # Return parsed JSON if successful
            if response.status_code >= 200 and response.status_code < 300:
                data = response.json()
                print(f"[INFO] Fetched {len(data)} interactions from Supabase")
                return data
            else:
                print(f"[WARN] Supabase fetch returned status {response.status_code}")
                
    except Exception as e:
        print(f"[ERROR] Failed to fetch interactions: {e}")
    
    return []


async def delete_interaction_by_id(row_id: str) -> int:
    """
    Delete a single interaction row by its unique ID.
    
    Args:
        row_id: Unique identifier of the row to delete (UUID string)
    
    Returns:
        Number of rows deleted (0 or 1). Returns 0 on error/misconfig.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE") or os.getenv("SUPABASE_ANON_KEY")
    table = os.getenv("SUPABASE_TABLE", "llm_interactions")

    # Return 0 if not configured or invalid ID
    if not supabase_url or not supabase_key or not table or not row_id:
        print("[WARN] Supabase not configured or invalid row_id, cannot delete")
        return 0

    endpoint = supabase_url.rstrip("/") + f"/rest/v1/{table}"
    
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Accept": "application/json",
        # Return deleted rows so we can count them
        "Prefer": "return=representation",
    }
    
    # Filter by exact ID match
    params = {
        "id": f"eq.{row_id}",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.delete(endpoint, headers=headers, params=params)
            
            if response.status_code >= 200 and response.status_code < 300:
                try:
                    data = response.json()
                    # Count deleted rows from response
                    if isinstance(data, list):
                        deleted_count = len(data)
                        print(f"[INFO] Deleted {deleted_count} interaction(s) with id={row_id}")
                        return deleted_count
                except Exception:
                    # If minimal/no body, infer success but can't confirm count
                    print(f"[INFO] Delete request succeeded for id={row_id} (count unknown)")
                    return 1
            else:
                print(f"[WARN] Delete request returned status {response.status_code}")
                
    except Exception as e:
        print(f"[ERROR] Failed to delete interaction: {e}")
    
    return 0