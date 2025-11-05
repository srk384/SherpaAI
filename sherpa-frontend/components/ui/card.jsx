"use client";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white p-6 shadow-md hover:shadow-lg transition-shadow dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("mb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn("text-lg font-bold", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("text-sm leading-relaxed", className)} {...props} />;
}

