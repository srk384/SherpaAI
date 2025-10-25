"use client";
import { useState } from "react";
import FeedItem from "@/components/feed-item";
import Dialog from "@/components/ui/dialog";

export default function Feed({ items = [], type, onDelete, loading = false }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  if (loading) {
    return (
      <div className="flex w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 p-8 dark:border-zinc-700">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
        <span className="ml-2 text-sm text-zinc-600 dark:text-zinc-400">Loading feed...</span>
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
        No items yet. Submit the form to see results here.
      </div>
    );
  }
  return (
    <>
      <div className="space-y-4">
        {items.map((it, idx) => {
          const t = type || it?.type || it?.output?.type;
          return (
            <FeedItem
              key={idx}
              item={it}
              type={t}
              onDelete={onDelete}
              onOpen={(item) => {
                setSelected(item);
                setOpen(true);
              }}
            />
          );
        })}
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={
          selected?.type === "transcript"
            ? selected?.input?.company || selected?.input?.name
            : selected?.input?.person || selected?.input?.company
        }
      >
        {selected ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Type</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {selected.type}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Input</p>
              <pre className="whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
                {JSON.stringify(selected.input, null, 2)}
              </pre>
            </div>
            <div>
              {/* <p className="text-sm font-medium">Result</p>
              <pre className="whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
                {selected.output.result}
              </pre> */}
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
