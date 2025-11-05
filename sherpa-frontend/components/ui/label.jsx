"use client";
import { cn } from "@/lib/utils";

export default function Label({ className, ...props }) {
  const base = "text-sm font-semibold text-zinc-900 dark:text-zinc-100";
  return <label className={cn(base, className)} {...props} />;
}

