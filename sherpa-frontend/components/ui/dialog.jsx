"use client";
import { useEffect } from "react";
import Button from "@/components/ui/button";

export default function Dialog({ open, onOpenChange, title, children, footer }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onOpenChange?.(false);
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange?.(false)}
      />
      <div className="relative z-10 w-full max-w-lg translate-y-0 rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-xl sm:rounded-2xl sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange?.(false)}>
            Close
          </Button>
        </div>
        <div>{children}</div>
        {footer ? <div className="mt-4">{footer}</div> : null}
      </div>
    </div>
  );
}

