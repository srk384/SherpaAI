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
    """Initialize and return a Groq API client configured with environment credentials."""
    return openai.OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=os.getenv("GROQ_API_KEY"),
    )


async def process_transcript(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a meeting transcript using LLM to generate insights.
    
    This function:
    1. Extracts metadata (name, company, attendees, date) from payload
    2. Sends transcript to LLM for analysis (what went well, improvements, recommendations)
    3. Logs the interaction to Supabase for persistence
    4. Returns structured result with type and content
    
    Args:
        payload: Dictionary containing transcript data and metadata
            - name: User's name
            - company: Company name
            - attendees: List or comma-separated string of attendees
            - date: Meeting date
            - transcript: Raw transcript text
    
    Returns:
        Dict with 'type' and 'result' keys containing the LLM analysis
    
    Raises:
        HTTPException: If LLM call fails after 3 retries or unexpected response format
    """
    # Artificial delay to simulate heavy processing and test queue behavior
    await asyncio.sleep(1)
    
    # Extract and normalize metadata from payload
    name = (payload.get("name") or "").strip()
    company = (payload.get("company") or "").strip()
    attendees = payload.get("attendees")
    
    # Handle attendees as either list or string
    if isinstance(attendees, list):
        attendees_str = ", ".join([str(a) for a in attendees])
    else:
        attendees_str = (attendees or "").strip()
    
    date_str = (payload.get("date") or "").strip()
    transcript_text = (payload.get("transcript") or "").strip()

    # Build prompt for LLM analysis
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

    # Retry logic with exponential backoff
    delay = 1.0
    last_exception = None
    
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
            
            # Extract content from LLM response
            content = completion.choices[0].message.content
            result = {"type": "transcript", "result": content}
            
            # CRITICAL: Log interaction with retry logic
            # Attempt to log up to 3 times before giving up
            log_success = False
            log_delay = 0.5
            
            for log_attempt in range(3):
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
                        extra={"company": company, "name": name},
                    )
                    log_success = True
                    break
                except Exception as log_error:
                    print(f"[WARN] Log attempt {log_attempt + 1}/3 failed: {log_error}")
                    if log_attempt < 2:
                        await asyncio.sleep(log_delay)
                        log_delay *= 2
                    else:
                        # On final failure, raise to trigger main retry loop
                        print(f"[ERROR] All Supabase logging attempts failed: {log_error}")
                        raise HTTPException(
                            status_code=500, 
                            detail=f"Supabase logging failed after 3 attempts: {str(log_error)}"
                        )
            
            if not log_success:
                raise HTTPException(status_code=500, detail="Failed to log interaction")
            
            # Success - return result
            return result
            
        except Exception as e:
            last_exception = e
            # On final attempt, raise the error
            if attempt == 2:
                print(f"[ERROR] process_transcript failed after 3 attempts: {e}")
                raise
            # Otherwise, wait and retry with exponential backoff
            print(f"[WARN] process_transcript attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
            await asyncio.sleep(delay)
            delay *= 2
    
    # Fallback (should never reach here due to raise in loop)
    raise last_exception or HTTPException(status_code=500, detail="Unknown error in process_transcript")


async def process_icebreaker(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate a personalized outreach icebreaker message using LinkedIn bio and sales deck.
    
    This function:
    1. Extracts LinkedIn bio and sales deck text from payload
    2. Uses LLM to craft a personalized, authentic outreach message
    3. Cleans up formatting (removes greetings, placeholders, extra whitespace)
    4. Logs the interaction to Supabase
    5. Returns the generated icebreaker
    
    Args:
        payload: Dictionary containing:
            - linkedinBio: LinkedIn "About" section text
            - deckText: Sales deck summary/content
    
    Returns:
        Dict with 'type' set to 'Icebreaker' and 'result' containing the message
    
    Raises:
        HTTPException: If LLM call fails after 3 retries or logging fails
    """
    linkedinBio = payload.get("linkedinBio", "")
    deckText = payload.get("deckText", "")

    # Build prompt for personalized icebreaker generation
    prompt = (
        "Using the following information, craft a personalized outreach icebreaker message."
        "\nAnalyze the LinkedIn bio to understand the person's role, tone, interests, and goals."
        "\nUse the sales deck to align the value proposition with their likely priorities or pain points."
        "\nInclude:"
        "\n- One personalized hook (based on something specific from their LinkedIn or company)."
        "\n- One insight or observation linking their background to what the deck offers."
        "\n- A natural transition line that sets up the conversation, without sounding salesy."
        "\nEnd with a friendly question or soft CTA that encourages a reply."
        "\n\nBe creative but authentic – sound like a human who did their homework."
        "\n\nInputs:"
        f"\nLinkedIn About Section:\n{linkedinBio}"
        f"\n\nSales Deck Summary:\n{deckText}"
    )

    client = _groq_client()

    # Retry logic with exponential backoff
    delay = 1.0
    last_exception = None
    
    for attempt in range(3):
        try:
            # Call LLM (synchronous SDK call, no thread needed for icebreaker)
            completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are an expert sales copywriter."},
                    {"role": "user", "content": prompt},
                ],
                model=os.getenv("GROQ_MODEL", "allam-2-7b"),
                temperature=0.3,
            )
            
            # Extract and clean content
            content = _extract_choice_content(completion)
            
            # Remove excessive whitespace
            content = re.sub(r"\s+", " ", content).strip()
            
            # Remove common greeting prefixes (Dear, Hi, Hello)
            content = re.sub(
                r"^(dear|hi|hello)\b[^,]*,?\s*", "", content, flags=re.IGNORECASE
            )
            
            # Remove placeholder brackets like [Company Name], [Your Name]
            content = re.sub(r"\[[^\]]+\]", "", content)
            
            response = {"type": "Icebreaker", "result": content}
            
            # CRITICAL: Log interaction with retry logic
            log_success = False
            log_delay = 0.5
            
            for log_attempt in range(3):
                try:
                    await log_interaction(
                        route="/api/v1/generate-icebreaker",
                        input_payload={"linkedinBio": linkedinBio, "deckText": deckText},
                        output_payload=response,
                        model=os.getenv("GROQ_MODEL"),
                    )
                    log_success = True
                    break
                except Exception as log_error:
                    print(f"[WARN] Log attempt {log_attempt + 1}/3 failed: {log_error}")
                    if log_attempt < 2:
                        await asyncio.sleep(log_delay)
                        log_delay *= 2
                    else:
                        print(f"[ERROR] All Supabase logging attempts failed: {log_error}")
                        raise HTTPException(
                            status_code=500, 
                            detail=f"Supabase logging failed after 3 attempts: {str(log_error)}"
                        )
            
            if not log_success:
                raise HTTPException(status_code=500, detail="Failed to log interaction")
            
            return response
            
        except Exception as e:
            last_exception = e
            if attempt == 2:
                print(f"[ERROR] process_icebreaker failed after 3 attempts: {e}")
                raise
            print(f"[WARN] process_icebreaker attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
            await asyncio.sleep(delay)
            delay *= 2
    
    raise last_exception or HTTPException(status_code=500, detail="Unknown error in process_icebreaker")


def _extract_choice_content(completion: Any) -> str:
    """
    Safely extract content string from LLM completion response.
    
    Handles multiple response formats from different SDK versions:
    - Object with .choices[0].message.content attributes
    - Dictionary with nested structure
    
    Args:
        completion: LLM completion response (object or dict)
    
    Returns:
        Extracted content string
    
    Raises:
        HTTPException: If content cannot be extracted from response
    """
    try:
        # Try SDK-style object attributes first
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
