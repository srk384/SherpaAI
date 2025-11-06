"use client";
import { cn } from "@/lib/utils";

export default function Label({ className, ...props }) {
  const base = "text-sm font-medium text-zinc-700 dark:text-zinc-300";
  return <label className={cn(base, className)} {...props} />;
}

