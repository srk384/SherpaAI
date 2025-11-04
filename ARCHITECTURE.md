## SherpaAI — Architecture and Data Flow

This document explains the high-level architecture, request/data flow, and how the async queue (Upstash QStash) is used to process transcript analysis jobs. It also covers local development behavior with FastAPI `BackgroundTasks` vs production/public deployments with QStash.

### Components
- **Frontend (Next.js app)**
  - Pages: `sherpa-frontend/app/transcript/page.jsx`, etc.
  - Calls backend APIs, renders the feed, shows job status and shimmer loading.
  - Polls for new items in the feed to reflect background job completion.

- **Backend (FastAPI)**
  - Routers: `Backend/src/api/routers/transcript.py`
  - Controllers: `Backend/src/api/controllers/transcript_controller.py`
  - Tasks/LLM calls: `Backend/src/services/tasks.py`
  - Logging: `Backend/src/services/supabase_logger.py`

- **Queue/Callback (Upstash QStash)**
  - Publishes a message to a public callback endpoint when running on a public URL.
  - Backend verifies QStash signatures for authentic callbacks.
  - On local loopback/private environments, falls back to local `BackgroundTasks` execution (no external queue).

### Key Endpoints
- `POST /api/v1/transcripts/jobs` — enqueue transcript analysis job (async). Returns immediately with `{ job_id, status: "queued", mode }`.
- `POST /api/v1/transcripts/callback` — the public callback consumed by QStash; kicks off background processing on the server.
- `GET /api/v1/transcripts?limit=&offset=` — returns the latest feed items (processed results) for the transcript page.
- (Legacy/Direct) `POST /api/v1/analyze-transcript` — direct analysis route used by older proxy in the frontend. For queue demos, prefer the async `jobs` route.

### High-Level Flow (Async Jobs)
1) Frontend submits a job:
   - `POST BACKEND_URL/api/v1/transcripts/jobs` with form payload `{ name, company, attendees, date, transcript }`.
   - Backend decides execution mode:
     - If server is public and not loopback/private: publish to QStash (Production).
     - Else: enqueue a local `BackgroundTasks` task (Development/local).

2) Backend returns immediately with `{ job_id, status: "queued", mode: "qstash" | "local" }`.

3) Worker execution:
   - QStash sends an HTTP POST to the backend callback `POST /api/v1/transcripts/callback` with the job body.
   - Backend verifies QStash request signatures (if configured) and schedules `process_transcript_task` as a background task.
   - In local mode, FastAPI `BackgroundTasks` directly schedules `process_transcript_task` without QStash.

4) Task processing (`process_transcript`):
   - File: `Backend/src/services/tasks.py`.
   - Adds an artificial delay (`await asyncio.sleep(60)`) to demonstrate queueing/latency.
   - Calls Groq via the OpenAI-compatible SDK to generate analysis.
   - Persists/logs result via `supabase_logger` (best-effort).
   - Saves output into storage/feed (depending on your persistence layer), which becomes visible to the feed API.

5) Frontend polling:
   - The transcript page polls the feed (`GET /api/v1/transcripts`) every second via a helper and resolves when an item matching the submitted input appears.
   - UI updates job status: Pending → Processing → Completed. Shimmer is shown while at least one job is running.

### Sequence Diagram (Production with QStash)

```
User Browser         Frontend (Next.js)         Backend (FastAPI)                 Upstash QStash
     |                        |                         |                                   |
     |  Submit form          |                         |                                   |
     |---------------------->|  POST /transcripts/jobs |                                   |
     |                       |------------------------>|  Build callback URL               |
     |                       |                         |  Publish to QStash                |
     |                       |<------------------------|  200 {status: queued}             |
     |  Show 'queued'        |                         |                                   |
     |  Start polling feed   |                         |                                   |
     |---------------------->|  GET /transcripts       |                                   |
     |  (every 1s)           |------------------------>|                                   |
     |                       |                         |<----------------------------------|
     |                       |                         |  QStash -> POST /transcripts/callback
     |                       |                         |  verify + schedule process task   |
     |                       |                         |  process_transcript (LLM + delay) |
     |                       |                         |  save/log result                  |
     |  Next poll            |  GET /transcripts       |                                   |
     |---------------------->|------------------------>|  returns feed incl. new item      |
     |  Match found          |                         |                                   |
     |  Update UI to 'done'  |                         |                                   |
```

### QStash Deep Dive

- **Publish**: In `enqueue_transcript_job_controller`, the backend determines if the callback URL is public. If public, it uses a QStash client to `publish` the job with JSON body and target callback URL (`/api/v1/transcripts/callback`).
- **Delivery**: QStash performs an HTTP POST to the callback endpoint with the queued payload. QStash may retry on failures (per Upstash policy). This decouples client request latency from heavy LLM work.
- **Verification**: The backend validates the incoming request using the QStash signing key(s) when configured, via `verify_qstash_request(request)`. Invalid signatures are rejected.
- **Local/Dev Mode**: If the callback URL is loopback/private, the server bypasses QStash and uses FastAPI `BackgroundTasks` to process jobs async, preserving the same logical flow without external dependencies.
- **Idempotency/At-Least-Once**: Treat callbacks as at-least-once delivery. Controllers should make processing idempotent (e.g., de-dupe on a job id if necessary).

### Data Contracts (Simplified)

Input Payload (enqueue):
```json
{
  "name": "string",
  "company": "string",
  "attendees": "string | string[]",
  "date": "YYYY-MM-DD",
  "transcript": "string"
}
```

Feed Item (simplified view):
```json
{
  "id": "string",
  "type": "transcript",
  "input": {
    "name": "string",
    "company": "string",
    "attendees": "string",
    "date": "YYYY-MM-DD"
  },
  "output": {
    "result": "string"
  },
  "created_at": "ISO-8601"
}
```

### Local vs Production Behavior

- Local (loopback/private URL):
  - `POST /transcripts/jobs` → schedules `BackgroundTasks` -> processes immediately on the same app instance.
  - No external queue, same callback shape simulated internally.

- Production/Public URL:
  - `POST /transcripts/jobs` → publishes to QStash → QStash invokes `POST /transcripts/callback`.
  - Backend verifies signature and runs the job in background.

### Timing and Demonstration Controls

- Artificial delay (for demo/testing):
  - `Backend/src/services/tasks.py` → `process_transcript` starts with `await asyncio.sleep(60)` to simulate heavy work and demonstrate queuing.
  - You can tune or remove this delay to reflect real processing latency.

- Frontend polling:
  - The transcript page polls the feed every second until a matching item appears.
  - In the 5-job test, 5 requests are enqueued simultaneously, and the UI tracks each job independently with per-job status and completion toasts.

### Operational Considerations

- **Retries & Backoff**: `process_transcript` implements simple retries with exponential backoff around the LLM call.
- **Authentication/Secrets**: Ensure `GROQ_API_KEY`, `QSTASH_TOKEN`, and signing keys (if used) are configured securely in the runtime environment.
- **Throughput & Concurrency**: QStash decouples inbound request latency from processing. You can scale backend workers horizontally; the callback handler should remain lightweight and schedule work off the main request thread.
- **Idempotency**: Consider idempotent job handling keyed by `job_id` to guard against duplicates in the event of retries.
- **Observability**: Add logs around enqueue, callback verification, start/finish of processing, and feed persistence to trace job lifecycles.

### Summary

- The client enqueues work quickly and immediately returns.
- QStash (production) or `BackgroundTasks` (local) triggers background processing.
- The backend processes the transcript asynchronously and writes results to storage.
- The frontend polls the feed and updates UI in real time per job as soon as results are available.


