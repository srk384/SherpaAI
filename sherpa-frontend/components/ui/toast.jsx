"use client";
import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    const duration = toast.duration ?? 3000;
    const t = { id, variant: toast.variant || "success", ...toast };
    setToasts((prev) => [...prev, t]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, duration);
    }
  }, []);

  const value = { addToast };

  const variantClass = (v) => {
    switch (v) {
      case "destructive":
        return "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200";
      case "success":
        return "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
      default:
        return "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100";
    }
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-16 z-1000 flex w-80 flex-col gap-2 sm:right-6 sm:top-20">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-md border p-3 shadow-md ${variantClass(t.variant)}`}
            role="status"
          >
            {t.title ? <div className="text-sm font-medium">{t.title}</div> : null}
            {t.description ? (
              <div className="mt-1 text-xs opacity-80 whitespace-pre-wrap">{t.description}</div>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

