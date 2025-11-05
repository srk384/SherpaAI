import os
import asyncio
import json
import uuid
from typing import Dict, Any, Set
from fastapi import HTTPException, Request, BackgroundTasks
from pydantic import BaseModel

from src.services.qstash_client import (
    get_qstash_client,
    qstash_publish_json,
    verify_qstash_request,
    build_callback_url,
    is_loopback_or_private,
)
from src.services.supabase_logger import fetch_interactions, delete_interaction_by_id
from src.services.tasks import process_transcript as process_transcript_task

# Global set to track running tasks and prevent garbage collection
_running_tasks: Set[asyncio.Task] = set()


class TranscriptRequest(BaseModel):
    """Request model for transcript analysis submission."""
    name: str
    company: str
    attendees: str
    date: str
    transcript: str


async def list_transcripts_controller(limit: int = 20, offset: int = 0):
    """
    Fetch a paginated list of transcript analysis records from Supabase.
    
    Args:
        limit: Maximum number of records to return (default: 20)
        offset: Number of records to skip for pagination (default: 0)
    
    Returns:
        Dict containing:
            - items: List of transcript records
            - limit: Applied limit
            - offset: Applied offset
    
    Raises:
        HTTPException(503): If Supabase is not configured
    """
    if not (os.getenv("SUPABASE_URL") and (os.getenv("SUPABASE_SERVICE_ROLE") or os.getenv("SUPABASE_ANON_KEY"))):
        raise HTTPException(status_code=503, detail="Supabase is not configured on the server")

    rows = await fetch_interactions(route="/api/v1/analyze-transcript", limit=limit, offset=offset)
    return {"items": rows, "limit": limit, "offset": offset}


async def delete_transcript_controller(id: str):
    """
    Delete a specific transcript record by ID from Supabase.
    
    Args:
        id: Unique identifier of the transcript record to delete
    
    Returns:
        Dict containing:
            - deleted: Number of records deleted (should be 1)
            - id: ID of the deleted record
    
    Raises:
        HTTPException(503): If Supabase is not configured
        HTTPException(404): If transcript with given ID is not found
    """
    if not (os.getenv("SUPABASE_URL") and (os.getenv("SUPABASE_SERVICE_ROLE") or os.getenv("SUPABASE_ANON_KEY"))):
        raise HTTPException(status_code=503, detail="Supabase is not configured on the server")

    deleted = await delete_interaction_by_id(id)
    if deleted <= 0:
        raise HTTPException(status_code=404, detail="Transcript not found")
    return {"deleted": deleted, "id": id}


async def enqueue_transcript_job_controller(data: TranscriptRequest, background_tasks: BackgroundTasks):
    """
    Enqueue a transcript analysis job either via QStash (production) or local processing (dev).
    
    Flow:
    1. Build callback URL from BACKEND_URL environment variable
    2. Check if URL is localhost/private (dev mode) or public (production)
    3. Dev mode: Process immediately in background without QStash
    4. Production: Send job to QStash queue which will callback when ready
    
    Args:
        data: TranscriptRequest containing all transcript metadata and content
        background_tasks: FastAPI background tasks (unused, kept for compatibility)
    
    Returns:
        Dict containing:
            - job_id: Unique identifier for tracking (QStash messageId or local UUID)
            - status: Always "queued" to indicate job is accepted
            - mode: Either "local" (dev) or "qstash" (production)
    
    Raises:
        HTTPException(500): If job enqueueing fails
    """
    try:
        # Build the callback URL that QStash will POST to when processing
        callback_endpoint = build_callback_url("/api/v1/transcripts/callback")

        # Local/dev mode: Process immediately without QStash
        if is_loopback_or_private(callback_endpoint):
            payload = data.model_dump() if hasattr(data, "model_dump") else data.dict()
            
            # Create task and keep reference to prevent garbage collection
            task = asyncio.create_task(_process_with_cleanup(payload))
            _running_tasks.add(task)
            task.add_done_callback(_running_tasks.discard)
            
            return {"job_id": f"local-{uuid.uuid4().hex}", "status": "queued", "mode": "local"}

        # Production mode: Use QStash for reliable distributed processing
        client = get_qstash_client()
        response = qstash_publish_json(client, url=callback_endpoint, body=data.model_dump())
        
        return {"job_id": response.get("messageId"), "status": "queued", "mode": "qstash"}
        
    except Exception as e:
        print(f"[ERROR] Failed to enqueue transcript job: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to enqueue job: {str(e)}")


async def _process_with_cleanup(payload: Dict[str, Any]):
    """
    Wrapper to process transcript and handle cleanup/error logging.
    
    This wrapper ensures errors are logged but don't crash the background task.
    Used for local/dev mode processing.
    
    Args:
        payload: Transcript data to process
    """
    try:
        await process_transcript_task(payload)
    except Exception as e:
        print(f"[ERROR] Background transcript processing failed: {e}")


async def process_transcript_callback_controller(request: Request, background_tasks: BackgroundTasks):
    """
    Handle QStash callback for transcript processing (webhook endpoint).
    
    OPTIMIZED APPROACH: Hybrid synchronous + async strategy
    
    Strategy:
    1. Verify request signature (security)
    2. Parse JSON payload
    3. For short jobs (<30s): Process synchronously and return result
    4. For long jobs (60s+): Acknowledge immediately, process in background with error tracking
    
    With the 60-second artificial delay, we use approach #4 to avoid QStash timeouts.
    
    Why this works:
    - QStash gets quick 202 response (won't timeout/retry)
    - Task runs in background with proper error handling
    - Failed tasks log errors for manual inspection
    - Supabase logging failures are captured and logged
    
    Alternative for production: Remove the 60s delay, then switch to synchronous processing
    
    Args:
        request: FastAPI Request object containing QStash callback data
        background_tasks: FastAPI background tasks for async processing
    
    Returns:
        Dict containing:
            - status: "accepted" (background processing) or "completed" (immediate)
            - job_id: Tracking identifier
    
    Raises:
        HTTPException(401): If QStash signature verification fails
        HTTPException(400): If payload is invalid JSON
    """
    try:
        # SECURITY: Verify this request actually came from QStash
        await verify_qstash_request(request)

        # Parse the callback payload
        raw = await request.body()
        try:
            body = json.loads(raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else raw)
        except Exception as parse_error:
            print(f"[ERROR] Failed to parse callback body: {parse_error}")
            raise HTTPException(status_code=400, detail="Invalid JSON payload")

        # Extract identifier for tracking
        job_id = body.get("name", "unknown")
        
        print(f"[INFO] Received QStash callback for job: {job_id}")
        
        # STRATEGY: Background processing with error tracking
        # This prevents QStash timeouts with the 60-second delay
        task = asyncio.create_task(_process_with_error_tracking(body, job_id))
        _running_tasks.add(task)
        task.add_done_callback(_running_tasks.discard)
        
        # Return immediately - QStash marks as delivered
        return {"status": "accepted", "job_id": job_id, "message": "Processing in background"}
        
    except HTTPException:
        # Re-raise HTTP exceptions (auth failures, etc.)
        raise
    except Exception as e:
        # Log unexpected errors
        print(f"[ERROR] Callback handling failed: {e.__class__.__name__}: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Callback failed: {e.__class__.__name__}: {str(e)}"
        )


async def _process_with_error_tracking(payload: Dict[str, Any], job_id: str):
    """
    Process transcript with comprehensive error tracking and logging.
    
    This wrapper ensures that:
    1. Processing errors are logged (not silent)
    2. Supabase logging failures are tracked
    3. Tasks don't crash the event loop
    4. You can inspect logs to find failed jobs
    
    In production, you could extend this to:
    - Write failures to a dead-letter queue
    - Send alerts on repeated failures
    - Store failure info in a separate Supabase table
    
    Args:
        payload: Transcript data to process
        job_id: Identifier for tracking in logs
    """
    try:
        print(f"[INFO] Starting background processing for job: {job_id}")
        
        # Process the transcript (includes LLM call + Supabase logging)
        result = await process_transcript_task(payload)
        
        print(f"[SUCCESS] Job completed successfully: {job_id}")
        
    except Exception as e:
        # CRITICAL: Log the failure details
        # In production, also consider:
        # - Storing in a failures table
        # - Sending to monitoring service (Sentry, etc.)
        # - Triggering manual retry mechanism
        print(f"[ERROR] Job failed: {job_id}")
        print(f"[ERROR] Error type: {e.__class__.__name__}")
        print(f"[ERROR] Error message: {str(e)}")
        print(f"[ERROR] Payload: {payload.get('company', 'N/A')} - {payload.get('name', 'N/A')}")
        
        # Optional: Store failure in Supabase for tracking
        try:
            from src.services.supabase_logger import log_interaction
            await log_interaction(
                route="/api/v1/analyze-transcript-failed",
                input_payload=payload,
                output_payload={"error": str(e), "error_type": e.__class__.__name__},
                model=os.getenv("GROQ_MODEL"),
                extra={"job_id": job_id, "status": "failed"}
            )
        except Exception as log_error:
            print(f"[ERROR] Could not log failure to Supabase: {log_error}")


# Optional: Add endpoint to check processing health and active tasks
async def get_processing_stats():
    """
    Get statistics about background processing tasks.
    
    Useful for monitoring and debugging.
    
    Returns:
        Dict containing:
            - active_tasks: Number of currently running background tasks
            - task_ids: List of tracked task IDs (for debugging)
    """
    return {
        "active_tasks": len(_running_tasks),
        "task_details": [
            {
                "done": task.done(),
                "cancelled": task.cancelled(),
            }
            for task in _running_tasks
        ]
    }