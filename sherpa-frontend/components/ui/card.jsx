"use client";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("mb-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn("text-base font-semibold", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("text-sm", className)} {...props} />;
}

