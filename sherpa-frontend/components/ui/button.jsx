"use client";
import { cn } from "@/lib/utils";

export default function Button({ className, variant = "default", size = "md", loading = false, disabled, children, ...props }) {
  const base = "inline-flex items-center justify-center font-semibold transition-all focus:outline-none disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    default: "bg-gradient-to-r from-zinc-900 to-zinc-700 text-white hover:from-zinc-800 hover:to-zinc-600 shadow-sm hover:shadow-md dark:from-zinc-100 dark:to-zinc-300 dark:text-black dark:hover:from-white dark:hover:to-zinc-200",
    outline: "border-2 border-zinc-300 bg-transparent hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900",
    ghost: "hover:bg-zinc-100 dark:hover:bg-zinc-800",
    secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
  };
  const sizes = {
    sm: "h-9 rounded-lg px-3 text-sm",
    md: "h-11 rounded-lg px-5 text-sm",
    lg: "h-12 rounded-xl px-6 text-base",
  };
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      aria-busy={loading ? "true" : undefined}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}
