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

export function ShimmerCard({ status = "analyzing" }) {
  return (
    <div className="w-full rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-lg dark:border-blue-900 dark:from-blue-950 dark:to-zinc-950">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-blue-500 animate-pulse"></div>
            </div>
            <div>
              <div className="font-semibold text-blue-900 dark:text-blue-100">
                {status === "queued" ? "Job Queued" : status === "processing" ? "Analyzing Transcript" : "Processing"}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                {status === "queued" ? "Waiting in queue..." : "AI is analyzing your meeting..."}
              </div>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-xs font-medium text-blue-700 dark:text-blue-300">
            In Progress
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <Shimmer className="h-4 w-full rounded" />
          <Shimmer className="h-4 w-5/6 rounded" />
          <Shimmer className="h-4 w-4/6 rounded" />
          <div className="pt-3 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></div>
            <span>Extracting insights and recommendations</span>
          </div>
        </div>
      </div>
    </div>
  );
}

