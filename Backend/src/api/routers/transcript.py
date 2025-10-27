from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
import os
import uuid
from src.services.supabase_logger import log_interaction, fetch_interactions, delete_interaction_by_id
from src.services.tasks import process_transcript as process_transcript_task
from src.services.qstash_client import (
    get_qstash_client,
    qstash_publish_json,
    verify_qstash_request,
    build_callback_url,
    is_loopback_or_private,
)

transcript_router = APIRouter()


class TranscriptRequest(BaseModel):
    name: str
    company: str
    attendees: str
    date: str
    transcript: str


@transcript_router.get("/transcripts")
async def list_transcripts(limit: int = 20, offset: int = 0):
    # Ensure Supabase is configured; return clear error if not
    if not (os.getenv("SUPABASE_URL") and (os.getenv("SUPABASE_SERVICE_ROLE") or os.getenv("SUPABASE_ANON_KEY"))):
        raise HTTPException(status_code=503, detail="Supabase is not configured on the server")

    rows = await fetch_interactions(route="/api/v1/analyze-transcript", limit=limit, offset=offset)
    return {"items": rows, "limit": limit, "offset": offset}


@transcript_router.delete("/transcripts/{id}")
async def delete_transcript(id: str):
    if not (os.getenv("SUPABASE_URL") and (os.getenv("SUPABASE_SERVICE_ROLE") or os.getenv("SUPABASE_ANON_KEY"))):
        raise HTTPException(status_code=503, detail="Supabase is not configured on the server")

    deleted = await delete_interaction_by_id(id)
    if deleted <= 0:
        raise HTTPException(status_code=404, detail="Transcript not found")
    return {"deleted": deleted, "id": id}


# ------------------QStash Queue------------------------

@transcript_router.post("/transcripts/jobs")
async def enqueue_transcript_job(data: TranscriptRequest, background_tasks: BackgroundTasks):
    """Enqueue transcript processing job to QStash."""
    try:
        callback_endpoint = build_callback_url("/api/v1/transcripts/callback")

        # If callback is loopback/private (local dev), bypass QStash and run locally
        if is_loopback_or_private(callback_endpoint):
            payload = data.model_dump() if hasattr(data, "model_dump") else data.dict()
            background_tasks.add_task(process_transcript_task, payload)
            return {"job_id": f"local-{uuid.uuid4().hex}", "status": "queued", "mode": "local"}

        client = get_qstash_client()
        # Publish message to QStash
        response = qstash_publish_json(client, url=callback_endpoint, body=data.model_dump())
        return {"job_id": response.get("messageId"), "status": "queued", "mode": "qstash"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to enqueue job: {str(e)}")


@transcript_router.post("/transcripts/callback")
async def process_transcript_callback(request: Request, background_tasks: BackgroundTasks):
    """Callback endpoint that QStash calls to process the job."""
    try:
        # Verify the request is from QStash (no-op in local/dev if not configured)
        await verify_qstash_request(request)

        # Get the body
        body = await request.json()

        # Process in background so QStash gets immediate response
        background_tasks.add_task(process_transcript_task, body)
        
        return {"status": "processing"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Callback failed: {str(e)}")


