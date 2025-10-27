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

  function renderIcebreaker(text) {
    if (!text) return null;
    const parts = String(text).split(/This message includes:/i);
    const header = parts[0] || "";
    const quoteMatch = header.match(/"([\s\S]*?)"/);
    const mainMessage = quoteMatch ? quoteMatch[1] : header.trim();

    const bulletsRaw = parts[1] || "";
    const items = bulletsRaw
      .split(/\s*\d+\.\s+/g)
      .map((s) => s.trim())
      .filter(Boolean);

    const bullets = items.map((s) => {
      const titleMatch = s.match(/\*\*(.+?)\*\*/);
      const title = titleMatch ? titleMatch[1] : s.split(":")[0];
      const rest = titleMatch ? s.replace(titleMatch[0], "").replace(/^:\s*/, "").trim() : s.replace(/^.*?:\s*/, "").trim();
      return { title, rest };
    });

    return (
      <div className="space-y-2">
        {mainMessage ? (
          <div>
            <p className="text-sm font-medium">Icebreaker</p>
            <p className="text-sm text-zinc-800 dark:text-zinc-200">{mainMessage}</p>
          </div>
        ) : null}
        {bullets.length ? (
          <div>
            <p className="text-sm font-medium">This message includes</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              {bullets.map((b, i) => (
                <li key={i}>
                  <span className="font-medium">{b.title}:</span> {b.rest}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  function renderMarkdownInline(str) {
    const parts = String(str).split(/(\*\*.+?\*\*)/g);
    return parts.map((part, i) => {
      const m = part.match(/^\*\*(.+)\*\*$/);
      if (m) return <strong key={i}>{m[1]}</strong>;
      return <span key={i}>{part}</span>;
    });
  }

  function splitTranscriptSections(text) {
    const src = String(text || "");
    const re = /(\*\*\s*)?(What\s+went\s+well|What\s+could\s+be\s+improved|Actionable\s+recommendations\s+for\s+next\s+time)(:\s*)?(\*\*)?/gi;
    const sections = [];
    let match;
    let lastIndex = 0;
    const order = [];
    while ((match = re.exec(src)) !== null) {
      const title = match[2];
      const start = match.index + match[0].length;
      const prev = sections.length ? sections[sections.length - 1] : null;
      if (prev) {
        prev.content = src.slice(prev.start, match.index).trim();
      }
      sections.push({ title, start, content: "" });
      order.push(title.toLowerCase());
      lastIndex = start;
    }
    if (sections.length) {
      sections[sections.length - 1].content = src.slice(sections[sections.length - 1].start).trim();
    }
    return sections;
  }

  function renderTranscript(text) {
    const sections = splitTranscriptSections(text);
    if (!sections.length) {
      return <pre className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">{text}</pre>;
    }

    function renderBlock(title, content) {
      const lines = String(content)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const bulletLines = lines.filter((l) => /^[-\u2022]\s+/.test(l));
      const orderedLines = lines.filter((l) => /^\d+\.\s+/.test(l));
      const hasBullets = bulletLines.length > 0;
      const hasOrdered = orderedLines.length > 0 && !hasBullets;

      return (
        <div className="space-y-1" key={title}>
          <p className="text-sm font-medium">{title}</p>
          {hasBullets ? (
            <ul className="ml-5 list-disc space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
              {bulletLines.map((l, i) => (
                <li key={i}>{renderMarkdownInline(l.replace(/^[-\u2022]\s+/, ""))}</li>
              ))}
            </ul>
          ) : hasOrdered ? (
            <ol className="ml-5 list-decimal space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
              {orderedLines.map((l, i) => (
                <li key={i}>{renderMarkdownInline(l.replace(/^\d+\.\s+/, ""))}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{renderMarkdownInline(lines.join(" "))}</p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {sections.map((s, idx) => renderBlock(s.title.replace(/\*\*/g, "").replace(/\s*:\s*$/, ""), s.content))}
      </div>
    );
  }

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
          {t === "icebreaker"
            ? renderIcebreaker(item?.output?.result || resultText)
            : renderTranscript(item?.output?.result || resultText)}
        </CardContent>
      </Card>
    </div>
  );
}
