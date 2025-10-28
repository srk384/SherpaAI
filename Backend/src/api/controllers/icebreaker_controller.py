import os
import re
import json
import uuid
from io import BytesIO
from typing import Any, List

import openai
from fastapi import HTTPException, UploadFile, File, Form, Request, BackgroundTasks
from pypdf import PdfReader

from src.services.qstash_client import (
    get_qstash_client,
    qstash_publish_json,
    verify_qstash_request,
    build_callback_url,
    is_loopback_or_private,
)
from src.services.supabase_logger import (
    log_interaction,
    fetch_interactions,
    delete_interaction_by_id,
)
from src.services.tasks import process_icebreaker as process_icebreaker_task


def _groq_client():
    return openai.OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=os.getenv("GROQ_API_KEY"),
    )


def _extract_choice_content(completion: Any) -> str:
    try:
        choices = getattr(completion, "choices", None)
        if choices and len(choices) > 0:
            message = getattr(choices[0], "message", None)
            if message is not None:
                if hasattr(message, "content"):
                    return getattr(message, "content") or ""
                if isinstance(message, dict):
                    return str(message.get("content", ""))

        if isinstance(completion, dict):
            try:
                return str(
                    completion.get("choices", [])[0]
                    .get("message", {})
                    .get("content", "")
                )
            except Exception:
                pass

        raise ValueError("choices[0].message.content not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected Groq response shape: {e}")


def _extract_pdf_text(pdf_bytes: bytes) -> str:
    if PdfReader is None:
        raise HTTPException(
            status_code=500,
            detail=("PDF parsing library missing. Install pypdf: pip install pypdf"),
        )
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid PDF file: {e}")

    pages_text: List[str] = []
    for i, page in enumerate(reader.pages):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        header = f"--- Slide {i+1} ---\n" if text.strip() else ""
        pages_text.append(f"{header}{text.strip()}")
    combined = "\n\n".join([t for t in pages_text if t])
    if not combined:
        raise HTTPException(
            status_code=422,
            detail=(
                "No extractable text found in PDF. The deck may be image-based. "
                "Use OCR (e.g., Tesseract) to convert images to text, or provide a text summary."
            ),
        )
    return combined


def _summarize_deck_with_groq(client: Any, raw_text: str) -> str:
    prompt = (
        "You are analyzing a pitch deck. Read the full extracted text and "
        "produce a concise executive summary capturing: product, ICP, pain points, "
        "value propositions, key features, metrics/ROI claims, differentiators, and proof/case studies. "
        "Keep it under 300-400 words and avoid speculation.\n\n"
        "Deck Text:\n" + raw_text
    )
    final = client.chat.completions.create(
        messages=[
            {"role": "system", "content": "You write concise executive summaries."},
            {"role": "user", "content": prompt},
        ],
        model=os.getenv("GROQ_MODEL", "allam-2-7b"),
        temperature=0.2,
    )
    summary = _extract_choice_content(final)
    summary = re.sub(r"\s+", " ", summary).strip()
    return summary


async def generate_icebreaker_from_pdf_controller(
    linkedinBio: str,
    pitchDeck: UploadFile,
):
    if pitchDeck.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported for pitchDeck")

    pdf_bytes = await pitchDeck.read()
    extracted_text = _extract_pdf_text(pdf_bytes)
    deck_summary = _summarize_deck_with_groq(_groq_client(), extracted_text)

    prompt = (
        "Using the following information, craft a personalized outreach icebreaker message."
        "\nAnalyze the LinkedIn bio to understand the person's role, tone, interests, and goals."
        "\nUse the sales deck to align the value proposition with their likely priorities or pain points."
        "\nInclude:"
        "\n- One personalized hook (based on something specific from their LinkedIn or company)."
        "\n- One insight or observation linking their background to what the deck offers."
        "\n- A natural transition line that sets up the conversation, without sounding salesy."
        "\nEnd with a friendly question or soft CTA that encourages a reply."
        "\n\nBe creative but authentic — sound like a human who did their homework."
        "\n\nInputs:"
        f"\nLinkedIn About Section:\n{linkedinBio}"
        f"\n\nSales Deck Summary (auto-generated):\n{deck_summary}"
    )

    chat_completion = _groq_client().chat.completions.create(
        messages=[
            {"role": "system", "content": "You are an expert sales copywriter."},
            {"role": "user", "content": prompt},
        ],
        model=os.getenv("GROQ_MODEL", "allam-2-7b"),
        temperature=0.3,
    )

    content = _extract_choice_content(chat_completion)
    content = re.sub(r"\s+", " ", content).strip()
    content = re.sub(r"^(dear|hi|hello)\b[^,]*,?\s*", "", content, flags=re.IGNORECASE)
    content = re.sub(r"\[[^\]]+\]", "", content)
    response = {"type": "Icebreaker", "result": content}

    try:
        await log_interaction(
            route="/api/v1/generate-icebreaker-from-pdf",
            input_payload={
                "linkedinBio": linkedinBio,
                "pitchDeck": {
                    "filename": getattr(pitchDeck, "filename", None),
                    "content_type": pitchDeck.content_type,
                    "bytes": len(pdf_bytes),
                },
                "extracted_text_preview": extracted_text[:1000],
                "deck_summary": deck_summary,
            },
            output_payload=response,
            model=os.getenv("GROQ_MODEL"),
        )
    except Exception:
        pass

    return response


async def list_icebreakers_controller(limit: int = 20, offset: int = 0, type: str = "all"):
    if not (
        os.getenv("SUPABASE_URL") and (os.getenv("SUPABASE_SERVICE_ROLE") or os.getenv("SUPABASE_ANON_KEY"))
    ):
        raise HTTPException(status_code=503, detail="Supabase is not configured on the server")

    type = (type or "all").lower()
    route_plain = "/api/v1/generate-icebreaker"
    route_pdf = "/api/v1/generate-icebreaker-from-pdf"

    if type == "plain":
        rows = await fetch_interactions(route=route_plain, limit=limit, offset=offset)
        return {"items": rows, "limit": limit, "offset": offset, "type": type}
    if type == "pdf":
        rows = await fetch_interactions(route=route_pdf, limit=limit, offset=offset)
        return {"items": rows, "limit": limit, "offset": offset, "type": type}

    rows_plain = await fetch_interactions(route=route_plain, limit=limit, offset=0)
    rows_pdf = await fetch_interactions(route=route_pdf, limit=limit, offset=0)
    merged = rows_plain + rows_pdf
    try:
        merged.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    except Exception:
        pass
    sliced = merged[offset : offset + limit]
    return {"items": sliced, "limit": limit, "offset": offset, "type": "all"}


async def delete_icebreaker_controller(id: str):
    if not (
        os.getenv("SUPABASE_URL") and (os.getenv("SUPABASE_SERVICE_ROLE") or os.getenv("SUPABASE_ANON_KEY"))
    ):
        raise HTTPException(status_code=503, detail="Supabase is not configured on the server")

    deleted = await delete_interaction_by_id(id)
    if deleted <= 0:
        raise HTTPException(status_code=404, detail="Icebreaker not found")
    return {"deleted": deleted, "id": id}


async def enqueue_icebreaker_job_controller(
    background_tasks: BackgroundTasks, linkedinBio: str, deckText: str
):
    try:
        callback_endpoint = build_callback_url("/api/v1/icebreakers/callback")
        payload = {"linkedinBio": linkedinBio, "deckText": deckText}

        if is_loopback_or_private(callback_endpoint):
            background_tasks.add_task(process_icebreaker_task, payload)
            return {"job_id": f"local-{uuid.uuid4().hex}", "status": "queued", "mode": "local"}

        client = get_qstash_client()
        response = qstash_publish_json(client, url=callback_endpoint, body=payload)
        return {"job_id": response.get("messageId"), "status": "queued", "mode": "qstash"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to enqueue job: {str(e)}")


async def process_icebreaker_callback_controller(request: Request, background_tasks: BackgroundTasks):
    try:
        await verify_qstash_request(request)
        raw = await request.body()
        try:
            body = json.loads(raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else raw)
        except Exception:
            body = {}

        background_tasks.add_task(process_icebreaker_task, body)
        return {"status": "processing"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Callback failed: {e.__class__.__name__}: {str(e)}")

