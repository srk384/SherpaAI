from fastapi import APIRouter, UploadFile, File, Form, Request, BackgroundTasks
from src.api.controllers import icebreaker_controller as ic

icebreaker_router = APIRouter()


@icebreaker_router.post("/generate-icebreaker-from-pdf")
async def generate_icebreaker_from_pdf(
    linkedinBio: str = Form(...),
    pitchDeck: UploadFile = File(...),
):
    return await ic.generate_icebreaker_from_pdf_controller(linkedinBio, pitchDeck)


@icebreaker_router.get("/icebreakers")
async def list_icebreakers(limit: int = 20, offset: int = 0, type: str = "all"):
    return await ic.list_icebreakers_controller(limit=limit, offset=offset, type=type)


@icebreaker_router.delete("/icebreakers/{id}")
async def delete_icebreaker(id: str):
    return await ic.delete_icebreaker_controller(id)

# ------------------QStash Queue------------------------

@icebreaker_router.post("/icebreakers/jobs")
async def enqueue_icebreaker_job(
    background_tasks: BackgroundTasks,
    linkedinBio: str = Form(...),
    deckText: str = Form(...),
):
    return await ic.enqueue_icebreaker_job_controller(background_tasks, linkedinBio, deckText)


@icebreaker_router.post("/icebreakers/callback")
async def process_icebreaker_callback(request: Request, background_tasks: BackgroundTasks):
    return await ic.process_icebreaker_callback_controller(request, background_tasks)

