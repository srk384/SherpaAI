"use client";
import { useCallback, useMemo, useState } from "react";
import Dialog from "@/components/ui/dialog";
import Button from "@/components/ui/button";

export default function UploadModal({ open, onOpenChange, onContent }) {
  const [dragOver, setDragOver] = useState(false);
  const [text, setText] = useState("");
  const [fileInfo, setFileInfo] = useState(null);
  const [file, setFile] = useState(null);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    handleFile(file);
  }, []);

  function handleFile(file) {
    setFile(file);
    setFileInfo({ name: file.name, size: file.size, type: file.type });
    const isText = file.type.startsWith("text/") || file.name.endsWith(".md");
    if (isText) {
      const reader = new FileReader();
      reader.onload = () => setText(reader.result?.toString() || "");
      reader.readAsText(file);
    } else if (file.name.toLowerCase().endsWith(".pdf")) {
      setText("");
    } else {
      setText("");
    }
  }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  const helper = useMemo(() => {
    if (!fileInfo) return "Paste deck content or drop a .txt/.pdf here";
    if (fileInfo.name.toLowerCase().endsWith(".pdf"))
      return "PDF uploaded. Text extraction requires backend; we captured filename+size.";
    return `Loaded ${fileInfo.name} (${fileInfo.size} bytes)`;
  }, [fileInfo]);

  function confirm() {
    const source = fileInfo?.name ? `${fileInfo.name} (${fileInfo.size} bytes)` : text.slice(0, 40) + (text.length > 40 ? "…" : "");
    onContent?.({ content: text, deckSource: source, file });
    onOpenChange(false);
    setText("");
    setFileInfo(null);
    setFile(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add Deck">
      <div
        className={`relative flex min-h-40 w-full cursor-pointer flex-col items-center justify-center rounded-xl border p-6 text-center ${
          dragOver
            ? "border-zinc-400 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900"
            : "border-dashed border-zinc-300 dark:border-zinc-700"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {helper}
        </p>
        <input
          type="file"
          accept=".txt,.md,.pdf"
          onChange={onFileChange}
          className="absolute inset-0 h-full w-full opacity-0"
        />
      </div>
      <div className="mt-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Or paste deck content here..."
          className="min-h-[120px] w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={confirm} disabled={!text && !fileInfo}>Use This</Button>
      </div>
    </Dialog>
  );
}
