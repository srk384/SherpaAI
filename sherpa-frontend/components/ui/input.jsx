"use client";
import { cn } from "@/lib/utils";

export default function Input({ className, ...props }) {
  const base = "flex h-11 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm transition-all placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:focus-visible:ring-blue-400/20 dark:focus-visible:border-blue-400";
  return <input className={cn(base, className)} {...props} />;
}

