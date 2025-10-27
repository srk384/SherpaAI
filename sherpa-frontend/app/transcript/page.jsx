"use client";
import { useEffect, useState } from "react";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import Textarea from "@/components/ui/textarea";
import Button from "@/components/ui/button";
import Separator from "@/components/ui/separator";
import Feed from "@/components/feed";
import Dialog from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

async function listFeed() {
  const res = await fetch(`${BACKEND_URL}/api/v1/transcripts?limit=20&offset=0`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load feed");
  const data = await res.json();
  return Array.isArray(data) ? data : data.items || [];
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
  const { addToast } = useToast();

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
    if (loading) return;
    setLoading(true);

    const url = "/api/analyze/transcript";
    let entry = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      entry = data; // { type, result, input, id? }
    } catch (err) {
      console.error(err);
    }
    // Re-fetch list from DB after new item is created
    try {
      const list = await listFeed();
      setItems(list);
      addToast({ title: "Transcript created", variant: "success" });
    } catch {}
    setForm({ name: "", attendees: "", date: "", company: "", transcript: "" });
    setLoading(false);
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
import { BACKEND_URL } from "@/lib/config";
