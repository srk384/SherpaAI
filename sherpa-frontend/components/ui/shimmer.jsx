export default function Shimmer({ className = "" }) {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="h-full w-full rounded-md bg-gradient-to-r from-zinc-200 via-zinc-300 to-zinc-200 bg-[length:200%_100%] dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-700" style={{
        animation: 'shimmer 1.5s ease-in-out infinite',
      }}></div>
      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </div>
  );
}

export function ShimmerCard() {
  return (
    <div className="w-full rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="space-y-3">
        {/* Header shimmer */}
        <div className="flex items-center gap-3">
          <Shimmer className="h-6 w-32 rounded" />
          <Shimmer className="h-5 w-20 rounded-full" />
          <Shimmer className="h-4 w-24 rounded" />
        </div>
        
        {/* Content shimmer */}
        <div className="space-y-2 pt-2">
          <Shimmer className="h-4 w-full rounded" />
          <Shimmer className="h-4 w-5/6 rounded" />
          <Shimmer className="h-4 w-4/6 rounded" />
          <div className="pt-2">
            <Shimmer className="h-4 w-full rounded" />
            <Shimmer className="mt-2 h-4 w-3/4 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

