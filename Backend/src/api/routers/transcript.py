from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import openai
from src.services.supabase_logger import log_interaction, fetch_interactions, delete_interaction_by_id

transcript_router = APIRouter()


class TranscriptRequest(BaseModel):
    name: str
    company: str
    attendees: str
    date: str
    transcript: str


@transcript_router.post("/analyze-transcript")
async def analyze_transcript(data: TranscriptRequest):
    # Normalize inputs and be tolerant of partial payloads to avoid 422s
    company = (data.company or "").strip()
    # attendees may come as a string or list; normalize to a readable string
    if isinstance(data.attendees, list):
        attendees_str = ", ".join([str(a) for a in data.attendees])
    else:
        attendees_str = (data.attendees or "").strip()
    date_str = (data.date or "").strip()
    transcript_text = (data.transcript or "").strip()

    prompt = (
        "Review the following meeting transcript and provide:"
        "\n- What went well"
        "\n- What could be improved"
        "\n- Actionable recommendations for next time"
        "\nBe concise, specific, and reference quotes when appropriate.\n\n"
        f"Company: {company}\nAttendees: {attendees_str}\nDate: {date_str}\n\n"
        f"Transcript:\n{transcript_text}"
    )
    client = openai.OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=os.getenv("GROQ_API_KEY"),
    )
    chat_completion = client.chat.completions.create(
        messages=[
            {"role": "system", "content": "You are an expert meeting coach."},
            {"role": "user", "content": prompt},
        ],
        model=os.getenv("GROQ_MODEL", "allam-2-7b"),
        temperature=0.3,
    )
    content = chat_completion.choices[0].message.content
    response = {"type": "transcript", "result": content}

    # Best-effort async log to Supabase; do not block on failures
    try:
        input_payload = (
            data.model_dump() if hasattr(data, "model_dump") else data.dict()
        )
        await log_interaction(
            route="/api/v1/analyze-transcript",
            input_payload=input_payload,
            output_payload=response,
            model=os.getenv("GROQ_MODEL"),
            extra={
                "company": input_payload.get("company"),
                "name": input_payload.get("name"),
            },
        )
    except Exception:
        pass

    return {"type": "transcript", "result": content, "input": data}


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
