"use client";
import { useEffect, useState, useRef } from "react";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import Textarea from "@/components/ui/textarea";
import Button from "@/components/ui/button";
import Separator from "@/components/ui/separator";
import Feed from "@/components/feed";
import UploadModal from "@/components/upload-modal";
import Dialog from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ShimmerCard } from "@/components/ui/shimmer";
import { BACKEND_URL } from "@/lib/config";

async function listFeed() {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/icebreakers?limit=20&offset=0&type=all`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load feed");
  const data = await res.json();
  return Array.isArray(data) ? data : data.items || [];
}

async function pollFeedForNewItem(baselineTopId, matchFn, onComplete, onError) {
  const maxAttempts = 60; // up to 60 seconds
  let attempts = 0;
  const tick = async () => {
    try {
      const items = await listFeed();
      const topId = items?.[0]?.id;
      const matched = items.find((it) => {
        try { return matchFn?.(it) === true; } catch { return false; }
      });
      if ((baselineTopId && topId && topId !== baselineTopId) || matched) {
        onComplete(items);
        return;
      }
      attempts++;
      if (attempts >= maxAttempts) {
        onError(new Error("Timed out waiting for result"));
        return;
      }
      setTimeout(tick, 1000);
    } catch (e) {
      onError(e);
    }
  };
  tick();
}

export default function IcebreakerPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    person: "",
    role: "",
    company: "",
    linkedinBio: "",
    deckText: "",
    pitchDeck: "",
    file: null,
  });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showShimmer, setShowShimmer] = useState(false);
  const { addToast } = useToast();
  const pollingRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await listFeed();
        setItems(list);
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function onDeckContent({ content, deckSource, file }) {
    setForm((f) => ({
      ...f,
      deckText: content || f.deckText,
      pitchDeck: deckSource || f.pitchDeck,
      file: file || f.file,
    }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (loading || pollingRef.current) return;
    setLoading(true);
    setShowShimmer(true);

    try {
      // Capture baseline from current state to avoid an extra fetch
      const baselineTopId = (items && items.length > 0) ? items[0]?.id : null;

      const isPdf = !!(form.file && (form.file.type?.includes("pdf") || /\.pdf$/i.test(form.file.name)));
      
      const fd = new FormData();
      fd.append("person", form.person || "");
      fd.append("role", form.role || "");
      fd.append("company", form.company || "");
      fd.append("linkedinBio", form.linkedinBio || "");
      if (form.deckText) fd.append("deckText", form.deckText);
      if (isPdf && form.file) fd.append("pitchDeck", form.file, form.file.name);

      if (isPdf) {
        // PDF: Use old synchronous endpoint
        const url = `${BACKEND_URL}/api/v1/generate-icebreaker-from-pdf`;
        const res = await fetch(url, { method: "POST", body: fd });
        
        if (!res.ok) {
          throw new Error("Failed to generate icebreaker from PDF");
        }
        
        await res.json();
        
        // Refresh feed
        const list = await listFeed();
        setItems(list);
        setShowShimmer(false);
        setLoading(false);
        addToast({ title: "Icebreaker created successfully!", variant: "success" });
        setForm({ person: "", role: "", company: "", linkedinBio: "", deckText: "", pitchDeck: "", file: null });
      } else {
        // Non-PDF: Use new job-based endpoint
        const url = `${BACKEND_URL}/api/v1/icebreakers/jobs`;
        const res = await fetch(url, { method: "POST", body: fd });
        
        if (!res.ok) {
          throw new Error("Failed to create job");
        }
        
        pollingRef.current = true;

        // Poll for feed change or matching item
        const matcher = (it) => {
          const inp = it?.input || {};
          const sameBio = (inp.linkedinBio || "").trim() === (form.linkedinBio || "").trim();
          const sameDeck = (inp.deckText || "").trim() === (form.deckText || "").trim();
          return sameBio && sameDeck;
        };

        await pollFeedForNewItem(
          baselineTopId,
          matcher,
          async (newItems) => {
            pollingRef.current = false;
            setShowShimmer(false);
            setLoading(false);
            setItems(newItems);
            addToast({ title: "Icebreaker created successfully!", variant: "success" });
            setForm({ person: "", role: "", company: "", linkedinBio: "", deckText: "", pitchDeck: "", file: null });
          },
          (err) => {
            pollingRef.current = false;
            setShowShimmer(false);
            setLoading(false);
            addToast({ title: "Job pending", description: "Result may appear shortly.", variant: "warning" });
          }
        );
      }
    } catch (err) {
      console.error(err);
      pollingRef.current = false;
      setShowShimmer(false);
      setLoading(false);
      addToast({ title: "Failed to submit. Please try again.", variant: "error" });
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent">
          LinkedIn Icebreaker
        </h1>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
          Generate personalized outreach messages using LinkedIn profiles and pitch decks.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="person">Name</Label>
            <Input
              id="person"
              name="person"
              value={form.person}
              onChange={onChange}
              placeholder="Priya Sharma"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              name="role"
              value={form.role}
              onChange={onChange}
              placeholder="Head of Sales"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              name="company"
              value={form.company}
              onChange={onChange}
              placeholder="Acme Inc."
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">LinkedIn Bio / About</Label>
          <Textarea
            id="bio"
            name="linkedinBio"
            value={form.linkedinBio}
            onChange={onChange}
            placeholder="Paste LinkedIn bio or company details..."
            required
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="deckText">Pitch Deck</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(true)}
            >
              Upload or Paste
            </Button>
          </div>
          <Textarea
            id="deckText"
            name="deckText"
            value={form.deckText}
            onChange={onChange}
            placeholder="Paste deck content here or use Upload above..."
          />
          {form.deckSource ? (
            <p className="mt-1 text-xs text-zinc-500">
              Source: {form.deckSource}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="submit" loading={loading} disabled={loading}>
            {loading ? "Generating..." : "Generate & Save"}
          </Button>
        </div>
      </form>

      <Separator />

      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Results</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Your generated icebreakers will appear below
        </p>
      </div>

      {showShimmer && (
        <div className="mb-6 animate-slide-up">
          <ShimmerCard status={loading ? "processing" : "queued"} />
        </div>
      )}
      
      <Feed
        items={items}
        type="icebreaker"
        loading={initializing}
        onDelete={(item) => {
          setToDelete(item);
          setConfirmOpen(true);
        }}
      />

      <Dialog
        open={confirmOpen}
        onOpenChange={(v) => {
          if (!deleting) setConfirmOpen(v);
        }}
        title="Delete this icebreaker?"
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This action permanently removes the item
          {toDelete?.input?.company ? ` for ${toDelete.input.company}` : ""}.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => setConfirmOpen(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700"
            loading={deleting}
            onClick={async () => {
              if (!toDelete) return;
              setDeleting(true);
              try {
                await fetch(
                  `${BACKEND_URL}/api/v1/icebreakers/${toDelete.id}`,
                  { method: "DELETE", headers: { "Content-Type": "application/json" } }
                );
                const list = await listFeed();
                setItems(list);
                setConfirmOpen(false);
                setToDelete(null);
                addToast({ title: "Icebreaker deleted", variant: "success" });
              } catch (e) {
                console.error(e);
              } finally {
                setDeleting(false);
              }
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>

      <UploadModal
        open={open}
        onOpenChange={setOpen}
        onContent={onDeckContent}
      />
    </main>
  );
}
