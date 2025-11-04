import os
import asyncio
import json
import uuid
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
from src.services.job_store import job_store


class TranscriptRequest(BaseModel):
    name: str
    company: str
    attendees: str
    date: str
    transcript: str


async def list_transcripts_controller(limit: int = 20, offset: int = 0):
    if not (os.getenv("SUPABASE_URL") and (os.getenv("SUPABASE_SERVICE_ROLE") or os.getenv("SUPABASE_ANON_KEY"))):
        raise HTTPException(status_code=503, detail="Supabase is not configured on the server")

    rows = await fetch_interactions(route="/api/v1/analyze-transcript", limit=limit, offset=offset)
    return {"items": rows, "limit": limit, "offset": offset}


async def delete_transcript_controller(id: str):
    if not (os.getenv("SUPABASE_URL") and (os.getenv("SUPABASE_SERVICE_ROLE") or os.getenv("SUPABASE_ANON_KEY"))):
        raise HTTPException(status_code=503, detail="Supabase is not configured on the server")

    deleted = await delete_interaction_by_id(id)
    if deleted <= 0:
        raise HTTPException(status_code=404, detail="Transcript not found")
    return {"deleted": deleted, "id": id}


async def enqueue_transcript_job_controller(data: TranscriptRequest, background_tasks: BackgroundTasks):
    try:
        callback_endpoint = build_callback_url("/api/v1/transcripts/callback")
        # Generate our own job_id and include it in the payload for correlation
        job_id = uuid.uuid4().hex
        payload = data.model_dump() if hasattr(data, "model_dump") else data.dict()
        payload["job_id"] = job_id
        await job_store.create(job_id, meta={"route": "/api/v1/analyze-transcript"})

        if is_loopback_or_private(callback_endpoint):
            # Schedule coroutine directly on the event loop
            asyncio.create_task(_run_transcript_job(payload))
            return {"job_id": job_id, "status": "queued", "mode": "local"}

        client = get_qstash_client()
        response = qstash_publish_json(client, url=callback_endpoint, body=payload)
        return {
            "job_id": job_id,
            "status": "queued",
            "mode": "qstash",
            "qstash_id": response.get("messageId"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to enqueue job: {str(e)}")


async def process_transcript_callback_controller(request: Request, background_tasks: BackgroundTasks):
    try:
        await verify_qstash_request(request)

        raw = await request.body()
        try:
            body = json.loads(raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else raw)
        except Exception:
            body = {}

        # Ensure we have a job_id for correlation; create if missing
        job_id = body.get("job_id") or uuid.uuid4().hex
        body["job_id"] = job_id
        await job_store.create(job_id, meta={"route": "/api/v1/analyze-transcript"})

        # Schedule coroutine directly; BackgroundTasks may not run async callables
        asyncio.create_task(_run_transcript_job(body))

        return {"status": "processing"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Callback failed: {e.__class__.__name__}: {str(e)}")


async def _run_transcript_job(payload: dict):
    """Execute the transcript job and update job status progressively."""
    job_id = str(payload.get("job_id") or uuid.uuid4().hex)
    await job_store.set_status(job_id, "processing")
    try:
        result = await process_transcript_task(payload)
        await job_store.set_status(job_id, "completed", result=result)
    except Exception as ex:
        await job_store.set_status(job_id, "failed", error=f"{ex.__class__.__name__}: {ex}")
