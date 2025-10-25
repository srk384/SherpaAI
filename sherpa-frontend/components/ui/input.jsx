"use client";
import { cn } from "@/lib/utils";

export default function Input({ className, ...props }) {
  const base = "flex h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-50/20";
  return <input className={cn(base, className)} {...props} />;
}

