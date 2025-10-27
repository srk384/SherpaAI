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

      <div className="mx-auto max-w-4xl px-6 py-24">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">SherpaAI</h1>
        <p className="mt-3 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Analyze meeting transcripts for actionable insights and generate personalized LinkedIn icebreakers from bios and pitch decks.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <a
            href="/transcript"
            className="group flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
          >
            <span className="mt-1 inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M16 13H8M16 17H8M10 9H8" />
              </svg>
            </span>
            <div>
              <h2 className="flex items-center gap-2 text-xl font-medium">
                Transcript Insight
                <span className="transition group-hover:translate-x-0.5">→</span>
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Upload a transcript with metadata and view generated insights in a feed.
              </p>
            </div>
          </a>

          <a
            href="/icebreaker"
            className="group flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
          >
            <span className="mt-1 inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                <path d="M8 10h8M8 14h5" />
              </svg>
            </span>
            <div>
              <h2 className="flex items-center gap-2 text-xl font-medium">
                LinkedIn Icebreaker
                <span className="transition group-hover:translate-x-0.5">→</span>
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Paste a LinkedIn bio and add a pitch deck (paste or upload) to generate a tailored opener.
              </p>
            </div>
          </a>
        </div>
      </div>
    </main>
  );
}
