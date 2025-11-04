import os
import asyncio
from typing import Any, Dict

from fastapi import HTTPException
import openai
import re
from dotenv import load_dotenv

from src.services.supabase_logger import log_interaction

load_dotenv()


def _groq_client():
    return openai.OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=os.getenv("GROQ_API_KEY"),
    )


async def process_transcript(payload: Dict[str, Any]) -> Dict[str, Any]:
    # Artificial delay to simulate heavy processing and test queue behavior
    await asyncio.sleep(10)
    name = (payload.get("name") or "").strip()
    company = (payload.get("company") or "").strip()
    attendees = payload.get("attendees")
    if isinstance(attendees, list):
        attendees_str = ", ".join([str(a) for a in attendees])
    else:
        attendees_str = (attendees or "").strip()
    date_str = (payload.get("date") or "").strip()
    transcript_text = (payload.get("transcript") or "").strip()

    prompt = (
        "Review the following meeting transcript and provide:"
        "\n- What went well"
        "\n- What could be improved"
        "\n- Actionable recommendations for next time"
        "\nBe concise, specific, and reference quotes when appropriate.\n\n"
        f"Company: {company}\nAttendees: {attendees_str}\nDate: {date_str}\n\n"
        f"Transcript:\n{transcript_text}"
    )

    client = _groq_client()

    # simple retry with backoff
    delay = 1.0
    for attempt in range(3):
        try:
            # Run blocking SDK call in a worker thread to avoid blocking the event loop
            completion = await asyncio.wait_for(
                asyncio.to_thread(
                    lambda: client.chat.completions.create(
                        messages=[
                            {"role": "system", "content": "You are an expert meeting coach."},
                            {"role": "user", "content": prompt},
                        ],
                        model=os.getenv("GROQ_MODEL", "allam-2-7b"),
                        temperature=0.3,
                    )
                ),
                timeout=120,
            )
            content = completion.choices[0].message.content
            result = {"type": "transcript", "result": content}
            # best-effort log
            try:
                await log_interaction(
                    route="/api/v1/analyze-transcript",
                    input_payload={
                        "name": name,
                        "company": company,
                        "attendees": attendees,
                        "date": date_str,
                        "transcript": transcript_text,
                    },
                    output_payload=result,
                    model=os.getenv("GROQ_MODEL"),
                    extra={
                        "company": company,
                        "name": name,
                        "job_id": payload.get("job_id"),
                    },
                )
            except Exception:
                pass
            return result
        except Exception:
            if attempt == 2:
                raise
            await asyncio.sleep(delay)
            delay *= 2


async def process_icebreaker(payload: Dict[str, Any]) -> Dict[str, Any]:
    linkedinBio = payload.get("linkedinBio", "")
    deckText = payload.get("deckText", "")

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
        f"\n\nSales Deck Summary:\n{deckText}"
    )

    client = _groq_client()

    delay = 1.0
    for attempt in range(3):
        try:
            completion = await asyncio.wait_for(
                asyncio.to_thread(
                    lambda: client.chat.completions.create(
                        messages=[
                            {"role": "system", "content": "You are an expert sales copywriter."},
                            {"role": "user", "content": prompt},
                        ],
                        model=os.getenv("GROQ_MODEL", "allam-2-7b"),
                        temperature=0.3,
                    )
                ),
                timeout=120,
            )
            content = _extract_choice_content(completion)
            # Clean formatting and placeholders
            content = re.sub(r"\s+", " ", content).strip()
            content = re.sub(
                r"^(dear|hi|hello)\b[^,]*,?\s*", "", content, flags=re.IGNORECASE
            )
            content = re.sub(r"\[[^\]]+\]", "", content)
            response = {"type": "Icebreaker", "result": content}
            try:
                await log_interaction(
                    route="/api/v1/generate-icebreaker",
                    input_payload={"linkedinBio": linkedinBio, "deckText": deckText},
                    output_payload=response,
                    model=os.getenv("GROQ_MODEL"),
                )
            except Exception:
                pass
            return response
        except Exception:
            if attempt == 2:
                raise
            await asyncio.sleep(delay)
            delay *= 2


def _extract_choice_content(completion: Any) -> str:
    try:
        # Prefer SDK-style attributes
        choices = getattr(completion, "choices", None)
        if choices and len(choices) > 0:
            message = getattr(choices[0], "message", None)
            if message is not None:
                if hasattr(message, "content"):
                    return getattr(message, "content") or ""
                if isinstance(message, dict):
                    return str(message.get("content", ""))

        # Fallback for dict-style responses
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
        raise HTTPException(
            status_code=500, detail=f"Unexpected Groq response shape: {e}"
        )
