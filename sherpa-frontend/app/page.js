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
    <main className="min-h-screen bg-background text-foreground">
      <WakeClient />
      <div className="mx-auto max-w-4xl px-6 py-20">
        <h1 className="text-3xl font-semibold">SherpaAI</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Pick a feature to start working with.</p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <a
            href="/transcript"
            className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow md:p-8 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <h2 className="text-xl font-medium">Transcript Insight ?</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Upload a transcript with metadata and view generated insights in a feed.
            </p>
          </a>

          <a
            href="/icebreaker"
            className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow md:p-8 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <h2 className="text-xl font-medium">LinkedIn Icebreaker ?</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Paste bio and deck or upload a doc to generate an outreach icebreaker.
            </p>
          </a>
        </div>
      </div>
    </main>
  );
}
