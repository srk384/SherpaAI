# 🧠 SherpaAI

> AI-powered meeting transcript analysis and LinkedIn icebreaker generation platform

SherpaAI helps sales and business professionals analyze meeting transcripts for actionable insights and generate personalized LinkedIn outreach messages using AI.

## 📑 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Folder Structure](#-folder-structure)
- [Prerequisites](#-prerequisites)
- [Setup Instructions](#-setup-instructions)
- [Running the Application](#-running-the-application)
- [Environment Variables](#-environment-variables)
- [API Documentation](#-api-documentation)
- [Architecture](#-architecture)
- [Contributing](#-contributing)

## ✨ Features

### 📊 Transcript Insight
- Upload meeting transcripts with metadata (company, attendees, date)
- AI-powered analysis provides:
  - What went well
  - What could be improved
  - Actionable recommendations for next time
- Store and retrieve past analyses
- Async job processing with real-time updates

### 💼 LinkedIn Icebreaker
- Generate personalized outreach messages
- Inputs: LinkedIn bio + Pitch deck (text or PDF)
- AI analyzes:
  - Prospect's role, interests, and pain points
  - Company value proposition alignment
  - Personalized hooks and conversation starters
- Support for both text and PDF pitch decks
- Async processing with shimmer loading states

### 🎨 User Experience
- Beautiful, modern UI with dark mode support
- Shimmer loading animations during processing
- Real-time toast notifications
- Responsive design for all devices

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 16 (React 19)
- **Styling**: Tailwind CSS
- **UI Components**: Custom component library
- **State Management**: React Hooks
- **Deployment**: Netlify

### Backend
- **Framework**: FastAPI (Python)
- **AI Provider**: Groq API (LLaMA models)
- **Task Queue**: Upstash QStash (HTTP queue)
- **Database**: Supabase (PostgreSQL)
- **PDF Processing**: pypdf
- **Deployment**: Render

### Infrastructure
- **Queue**: Upstash QStash
- **File Storage**: Supabase Storage
- **API**: REST

## 📁 Folder Structure

```
SherpaAI/
├── Backend/
│   ├── src/
│   │   ├── api/
│   │   │   └── routers/
│   │   │       ├── transcript.py        # Transcript analysis endpoints
│   │   │       └── icebreaker.py        # Icebreaker generation endpoints
│   │   ├── services/
│   │   │   ├── tasks.py                 # Async task functions (QStash callbacks)
│   │   │   └── supabase_logger.py       # Database interaction layer
│   │   ├── main.py                      # FastAPI application entry point
│   ├── requirements.txt                 # Python dependencies
│   └── .env                            # Environment variables (not in repo)
│
├── sherpa-frontend/
│   ├── app/
│   │   ├── api/                        # Next.js API routes (optional)
│   │   ├── transcript/
│   │   │   └── page.jsx                # Transcript analysis page
│   │   ├── icebreaker/
│   │   │   └── page.jsx                # Icebreaker generation page
│   │   ├── layout.js                   # Root layout with providers
│   │   ├── page.js                     # Home page
│   │   └── globals.css                 # Global styles
│   ├── components/
│   │   ├── ui/                         # Reusable UI components
│   │   │   ├── button.jsx
│   │   │   ├── card.jsx
│   │   │   ├── input.jsx
│   │   │   ├── textarea.jsx
│   │   │   ├── shimmer.jsx             # Loading shimmer component
│   │   │   └── ...
│   │   ├── feed.jsx                    # Feed container component
│   │   ├── feed-item.jsx               # Individual feed item
│   │   └── upload-modal.jsx            # PDF/text upload modal
│   ├── lib/
│   │   ├── config.js                   # Configuration constants
│   │   └── utils.js                    # Utility functions
│   ├── public/                         # Static assets
│   ├── package.json                    # Node dependencies
│   ├── next.config.mjs                 # Next.js configuration
│   └── .env.local                      # Environment variables (not in repo)
│
└── README.md                          # This file
```

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) and npm
- **Python** (v3.9 or higher) and pip
- **Git**

## 🚀 Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd SherpaAI
```

### 2. Backend Setup

```bash
cd Backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env  # Or create manually
```

**Configure `Backend/.env`:**
```env
# Groq API
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE=your_supabase_service_role_key
SUPABASE_TABLE=llm_interactions

# CORS
CLIENT_URL=http://localhost:3000,https://your-production-url.com

# Upstash QStash
QSTASH_TOKEN=your_qstash_token
# Optional (enables signature verification for callbacks)
QSTASH_CURRENT_SIGNING_KEY=your_qstash_current_signing_key
QSTASH_NEXT_SIGNING_KEY=your_qstash_next_signing_key

# Backend base URL used to construct QStash callback URLs
BACKEND_URL=http://localhost:8000
```

**Get API Keys:**
- **Groq API**: Sign up at [console.groq.com](https://console.groq.com/)
- **Supabase**: Create project at [supabase.com](https://supabase.com/)

### 3. Frontend Setup

```bash
cd sherpa-frontend

# Install dependencies
npm install

# Create .env.local file
cp .env.example .env.local  # Or create manually
```

**Configure `sherpa-frontend/.env.local`:**
```env
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

### 4. Database Setup (Supabase)

Create a table in Supabase:

```sql
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route TEXT NOT NULL,
  input_payload JSONB,
  output_payload JSONB,
  model TEXT,
  extra JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_interactions_route ON interactions(route);
CREATE INDEX idx_interactions_created_at ON interactions(created_at DESC);
```

## 🏃 Running the Application

You need **4 separate terminal windows** to run the full stack:

### Terminal 1: Start FastAPI Backend
```bash
cd Backend
# Activate venv first
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

**Access:**
- API: http://127.0.0.1:8000
- Docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/wake

### Terminal 2: Start Next.js Frontend
```bash
cd sherpa-frontend
npm run dev
```

**Access:**
- Frontend: http://localhost:3000

## 🌍 Environment Variables

### Backend (`Backend/.env`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `GROQ_API_KEY` | ✅ | Groq API key for AI models | `gsk_...` |
| `GROQ_MODEL` | ✅ | Model to use | `llama-3.3-70b-versatile` |
| `SUPABASE_URL` | ✅ | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE` | ⚠️ | Service role key (or use ANON) | `eyJ...` |
| `SUPABASE_ANON_KEY` | ⚠️ | Anon key (or use SERVICE_ROLE) | `eyJ...` |
| `CLIENT_URL` | ✅ | Allowed CORS origins | `http://localhost:3000` |

### Frontend (`sherpa-frontend/.env.local`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_BACKEND_URL` | ✅ | Backend API URL | `http://127.0.0.1:8000` |

## 📡 API Documentation

### Transcript Endpoints

#### Create Transcript Job (Async)
```http
POST /api/v1/transcripts/jobs
Content-Type: application/json

{
  "name": "John Doe",
  "company": "Acme Inc.",
  "attendees": "John, Jane, Bob",
  "date": "2024-01-15",
  "transcript": "Meeting transcript text..."
}

Response: { "job_id": "abc123", "status": "queued" }
```


#### List Transcripts
```http
GET /api/v1/transcripts?limit=20&offset=0

Response: {
  "items": [...],
  "limit": 20,
  "offset": 0
}
```

#### Delete Transcript
```http
DELETE /api/v1/transcripts/{id}

Response: { "deleted": 1, "id": "..." }
```

### Icebreaker Endpoints

#### Create Icebreaker Job (Async, Non-PDF)
```http
POST /api/v1/icebreakers/jobs
Content-Type: multipart/form-data

linkedinBio: "..."
deckText: "..."

Response: { "job_id": "xyz789", "status": "queued" }
```

#### Generate from PDF (Sync)
```http
POST /api/v1/generate-icebreaker-from-pdf
Content-Type: multipart/form-data

linkedinBio: "..."
pitchDeck: <PDF file>

Response: { "type": "Icebreaker", "result": "..." }
```


#### List Icebreakers
```http
GET /api/v1/icebreakers?limit=20&offset=0&type=all

Response: {
  "items": [...],
  "limit": 20,
  "offset": 0,
  "type": "all"  // or "plain", "pdf"
}
```

#### Delete Icebreaker
```http
DELETE /api/v1/icebreakers/{id}

Response: { "deleted": 1, "id": "..." }
```

## 🏗️ Architecture

### Async Job Processing Flow

- Client submits a job to FastAPI.
- FastAPI builds a public callback URL and either:
  - Publishes to Upstash QStash (prod/public URL), which calls back the server, or
  - Runs locally via BackgroundTasks (dev/loopback URL).
- Task processes with Groq and logs to Supabase.
- Client polls the feed endpoint for new items and displays results.
### Component Hierarchy

```
App Layout
├── Transcript Page
│   ├── Form (Input fields)
│   ├── Shimmer Card (Loading state)
│   └── Feed
│       └── Feed Items (Cards)
│
└── Icebreaker Page
    ├── Form (Input fields)
    ├── Upload Modal (PDF/Text)
    ├── Shimmer Card (Loading state)
    └── Feed
        └── Feed Items (Cards)
```

## 🎯 Key Features Explained

### 1. Shimmer Loading Effect
- Appears immediately when user submits a form
- Animated gradient provides visual feedback
- Disappears when job completes
- Located: `sherpa-frontend/components/ui/shimmer.jsx`

### 2. Job Polling Mechanism
- Client polls backend every 1 second
- Maximum 60 attempts (60 seconds timeout)
- Updates the list and hides the shimmer upon completion`r`n
### 3. Dual Processing Modes
- **Async Jobs**: Transcripts and text-based icebreakers
  - Non-blocking API responses
    - QStash calls back the server (prod) or local BackgroundTasks (dev)`r`n  - Client polls for results
- **Sync Processing**: PDF icebreakers
  - Direct processing (no queue)
  - Immediate response
  - Still shows shimmer for UX consistency

### 4. AI-Powered Analysis
- Uses Groq's LLaMA models for fast inference
- Transcript analysis: Structured feedback with actionable insights
- Icebreaker generation: Personalized messages based on context
- PDF processing: Extract text → Summarize → Generate icebreaker

## 🐛 Troubleshooting

### QStash Callback Not Delivered\n- Ensure `BACKEND_URL` is a public HTTPS URL (not localhost/127.0.0.1).\n- Verify `QSTASH_TOKEN` is valid.\n- Optionally enable signature verification with `QSTASH_CURRENT_SIGNING_KEY`.\n- Check server logs around `/api/v1/*/callback` handlers\n\n### Job Seems Slow or Stuck
```bash

cd Backend

```

### Job Timeout Errors
- - Check GROQ_API_KEY is valid
- - 
### CORS Errors
- Ensure `CLIENT_URL` in backend `.env` includes frontend URL
- Check CORS middleware in `Backend/src/main.py`

### Database Connection Issues
- Verify Supabase credentials in `.env`
- Check table exists (see Database Setup)
- Ensure API keys have correct permissions

## 📚 Additional Resources

- [Upstash QStash Docs](https://upstash.com/docs/qstash)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Groq API Documentation](https://console.groq.com/docs)
- [Supabase Documentation](https://supabase.com/docs)

## 📝 Development Notes

### Adding New Tasks
1. Define task function in `Backend/src/services/tasks.py`
2. Create/extend enqueue and callback endpoints to run the task via QStash or BackgroundTasks.


