"use client";
import { useEffect } from "react";
import { BACKEND_URL } from "@/lib/config";

function WakeClient() {
  useEffect(() => {
    fetch(`${BACKEND_URL}/wake`).catch(() => {});
  }, []);
  return null;
}

export default function Home() {
  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <WakeClient />
      {/* subtle background accent */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-10%] h-64 w-[60rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-zinc-200 to-transparent blur-3xl dark:from-zinc-900/40" />
      </div>

      <div className="mx-auto max-w-5xl px-6 py-32">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent">
          SherpaAI
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Analyze meeting transcripts for actionable insights and generate personalized LinkedIn icebreakers from bios and pitch decks.
        </p>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          <a
            href="/transcript"
            className="group flex items-start gap-5 rounded-2xl border-2 border-zinc-200 bg-white p-8 shadow-lg hover:shadow-xl hover:border-blue-300 transition-all dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-blue-700"
          >
            <span className="mt-1 inline-flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 dark:from-blue-950 dark:to-blue-900 dark:text-blue-400">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M16 13H8M16 17H8M10 9H8" />
              </svg>
            </span>
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-bold">
                Transcript Insight
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </h2>
              <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
                Upload a transcript with metadata and view AI-generated insights in a feed.
              </p>
            </div>
          </a>

          <a
            href="/icebreaker"
            className="group flex items-start gap-5 rounded-2xl border-2 border-zinc-200 bg-white p-8 shadow-lg hover:shadow-xl hover:border-emerald-300 transition-all dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-emerald-700"
          >
            <span className="mt-1 inline-flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 dark:from-emerald-950 dark:to-emerald-900 dark:text-emerald-400">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                <path d="M8 10h8M8 14h5" />
              </svg>
            </span>
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-bold">
                LinkedIn Icebreaker
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </h2>
              <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
                Paste a LinkedIn bio and add a pitch deck to generate a tailored opener.
              </p>
            </div>
          </a>
        </div>
      </div>
    </main>
  );
}
