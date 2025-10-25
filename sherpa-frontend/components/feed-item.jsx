import Badge from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Button from "@/components/ui/button";
import { TrashIcon } from "@/components/icons";

function toResultText(item) {
  // Support old local shape (item.output) by converting to a string
  if (item?.output && !item?.result) {
    // New backend shape: item.output.result is a single formatted string
    if (typeof item.output.result === "string") {
      return item.output.result;
    }
    if (item.output.well || item.output.better || item.output.recommendations) {
      return `What went well:\n${item.output.well || "-"}\n\nWhat could be improved:\n${item.output.better || "-"}\n\nActionable recommendations for next time:\n${item.output.recommendations || "-"}`;
    }
    if (item.output.icebreaker || item.output.signals) {
      return `Icebreaker:\n${item.output.icebreaker || "-"}\n\nBuying signals:\n${item.output.signals || "-"}`;
    }
  }
  return item?.result || "";
}

export default function FeedItem({ item, type, onDelete, onOpen }) {
  const t = type || item?.type || item?.output?.type || "transcript";
  const input = item?.input || item; // fallback to old shape
  const title =
    t === "transcript"
      ? input?.company || input?.name || "Transcript"
      : input?.person || input?.company || "Icebreaker";
  // Prefer a valid date from input.date; otherwise fallback to created_at
  let date = input?.date;
  const createdAt = item?.created_at;
  const parsed = date ? Date.parse(date) : NaN;
  if (!date || Number.isNaN(parsed)) {
    date = createdAt;
  }
  const attendees = input?.attendees;
  const deckSource = item?.deckSource || input?.deckSource;
  const resultText = toResultText(item);

  return (
    <div className="group relative">
      <button
        title="Delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete?.(item);
        }}
        className="absolute right-2 top-2 z-10 hidden rounded-md bg-red-600 p-1 text-white opacity-0 transition group-hover:block group-hover:opacity-100"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
      <Card className="w-full cursor-pointer" onClick={() => onOpen?.(item)}>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{title}</CardTitle>
            <Badge>{t}</Badge>
            {date ? (
              <span className="text-xs text-zinc-500">{new Date(date).toLocaleDateString()}</span>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {t === "transcript" && attendees ? (
            <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">Attendees: {attendees}</p>
          ) : null}
          {deckSource && t !== "transcript" ? (
            <p className="mb-2 text-xs text-zinc-500">Deck Source: {deckSource}</p>
          ) : null}
          <pre className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">{resultText}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
