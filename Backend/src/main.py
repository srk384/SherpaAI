from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from src.api.routers.transcript import transcript_router
from src.api.routers.icebreaker import icebreaker_router
import os

load_dotenv()
app = FastAPI()

origins_str = os.getenv("CLIENT_URL", "http://localhost:8000, http://127.0.0.1:3000")
origins = [origin.strip() for origin in origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/wake")
def root_get():
    return "server is awake"


app.include_router(transcript_router, prefix="/api/v1")
app.include_router(icebreaker_router, prefix="/api/v1")
