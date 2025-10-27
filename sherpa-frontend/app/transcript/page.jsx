"use client";
import { useEffect, useState, useRef } from "react";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import Textarea from "@/components/ui/textarea";
import Button from "@/components/ui/button";
import Separator from "@/components/ui/separator";
import Feed from "@/components/feed";
import Dialog from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ShimmerCard } from "@/components/ui/shimmer";
import { BACKEND_URL } from "@/lib/config";

async function listFeed() {
  const res = await fetch(`${BACKEND_URL}/api/v1/transcripts?limit=20&offset=0`, { cache: "no-store" });
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

export default function TranscriptPage() {
  const [form, setForm] = useState({
    name: "",
    attendees: "",
    date: "",
    company: "",
    transcript: "",
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

  async function onSubmit(e) {
    e.preventDefault();
    if (loading || pollingRef.current) return;
    setLoading(true);
    setShowShimmer(true);

    try {
      // Capture baseline from current state to avoid an extra fetch
      const baselineTopId = (items && items.length > 0) ? items[0]?.id : null;

      // Create job
      const res = await fetch(`${BACKEND_URL}/api/v1/transcripts/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      
      if (!res.ok) {
        throw new Error("Failed to create job");
      }
      
      const data = await res.json();
      pollingRef.current = true;

      // Define a matcher using submitted input fields
      const matcher = (it) => {
        const inp = it?.input || {};
        const sameCompany = (inp.company || "").trim() === (form.company || "").trim();
        const sameName = (inp.name || "").trim() === (form.name || "").trim();
        const sameDate = (inp.date || "").trim() === (form.date || "").trim();
        return sameCompany && sameName && sameDate;
      };

      await pollFeedForNewItem(
        baselineTopId,
        matcher,
        async (newItems) => {
          pollingRef.current = false;
          setShowShimmer(false);
          setLoading(false);
          setItems(newItems);
          addToast({ title: "Transcript analyzed successfully!", variant: "success" });
          setForm({ name: "", attendees: "", date: "", company: "", transcript: "" });
        },
        (err) => {
          pollingRef.current = false;
          setShowShimmer(false);
          setLoading(false);
          addToast({ title: "Job pending", description: "Result may appear shortly.", variant: "warning" });
        }
      );
    } catch (err) {
      console.error(err);
      pollingRef.current = false;
      setShowShimmer(false);
      setLoading(false);
      addToast({ title: "Failed to submit. Please try again.", variant: "error" });
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Transcript Insight</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Paste a transcript with meeting metadata. Insights will appear below.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              name="name"
              value={form.name}
              onChange={onChange}
              placeholder="Alex"
              required
            />
          </div>
          <div>
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
          <div>
            <Label htmlFor="attendees">Attendees</Label>
            <Input
              id="attendees"
              name="attendees"
              value={form.attendees}
              onChange={onChange}
              placeholder="Alex, Priya, Sam"
              required
            />
          </div>
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              name="date"
              type="date"
              value={form.date}
              onChange={onChange}
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="transcript">Transcript</Label>
          <Textarea
            id="transcript"
            name="transcript"
            value={form.transcript}
            onChange={onChange}
            placeholder="Paste meeting transcript here..."
            required
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="submit" loading={loading} disabled={loading}>
            {loading ? "Analyzing" : "Analyze & Save"}
          </Button>
        </div>
      </form>

      <Separator />
      <h2 className="mb-3 text-lg font-medium">Feed</h2>
      
      {/* Show shimmer card while job is processing */}
      {showShimmer && (
        <div className="mb-4">
          <ShimmerCard />
        </div>
      )}
      
      <Feed
        items={items}
        type="transcript"
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
        title="Delete this transcript?"
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This action permanently removes the item{toDelete?.input?.company ? ` for ${toDelete.input.company}` : ""}.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700"
            loading={deleting}
            onClick={async () => {
              if (!toDelete) return;
              setDeleting(true);
              try {
                await fetch(`${BACKEND_URL}/api/v1/transcripts/${toDelete.id}`, {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                });
                const list = await listFeed();
                setItems(list);
                setConfirmOpen(false);
                setToDelete(null);
                addToast({ title: "Transcript deleted", variant: "success" });
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
    </main>
  );
}
