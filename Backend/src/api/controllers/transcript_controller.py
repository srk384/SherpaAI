import os
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

        if is_loopback_or_private(callback_endpoint):
            payload = data.model_dump() if hasattr(data, "model_dump") else data.dict()
            background_tasks.add_task(process_transcript_task, payload)
            return {"job_id": f"local-{uuid.uuid4().hex}", "status": "queued", "mode": "local"}

        client = get_qstash_client()
        response = qstash_publish_json(client, url=callback_endpoint, body=data.model_dump())
        return {"job_id": response.get("messageId"), "status": "queued", "mode": "qstash"}
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

        background_tasks.add_task(process_transcript_task, body)

        return {"status": "processing"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Callback failed: {e.__class__.__name__}: {str(e)}")

