import { cn } from "@/lib/utils";

export default function Badge({ className, variant = "default", ...props }) {
  const styles = {
    default: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
    outline: "border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[variant],
        className
      )}
      {...props}
    />
  );
}

