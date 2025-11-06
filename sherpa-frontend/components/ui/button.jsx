"use client";
import { cn } from "@/lib/utils";

export default function Button({ className, variant = "default", size = "md", loading = false, disabled, children, ...props }) {
  const base = "inline-flex items-center justify-center font-medium transition focus:outline-none disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    default: "bg-black text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-white",
    outline: "border border-zinc-300 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800",
    ghost: "hover:bg-zinc-100 dark:hover:bg-zinc-800",
  };
  const sizes = {
    sm: "h-8 rounded-md px-3 text-sm",
    md: "h-10 rounded-md px-4 text-sm",
    lg: "h-11 rounded-lg px-5 text-base",
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
