from fastapi import APIRouter, Request, BackgroundTasks
from src.api.controllers import transcript_controller as tc

transcript_router = APIRouter()


@transcript_router.get("/transcripts")
async def list_transcripts(limit: int = 20, offset: int = 0):
    return await tc.list_transcripts_controller(limit=limit, offset=offset)


@transcript_router.delete("/transcripts/{id}")
async def delete_transcript(id: str):
    return await tc.delete_transcript_controller(id)


# ------------------QStash Queue------------------------

@transcript_router.post("/transcripts/jobs")
async def enqueue_transcript_job(data: tc.TranscriptRequest, background_tasks: BackgroundTasks):
    return await tc.enqueue_transcript_job_controller(data, background_tasks)


@transcript_router.post("/transcripts/callback")
async def process_transcript_callback(request: Request, background_tasks: BackgroundTasks):
    return await tc.process_transcript_callback_controller(request, background_tasks)


@transcript_router.get("/transcripts/jobs/{job_id}")
async def get_transcript_job_status(job_id: str):
    # Lightweight per-job status endpoint so the client can show results as they are ready
    from src.services.job_store import job_store

    data = await job_store.get(job_id)
    if not data:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Job not found")
    return data


