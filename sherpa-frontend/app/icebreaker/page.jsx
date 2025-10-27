"use client";
import { useEffect, useState } from "react";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import Textarea from "@/components/ui/textarea";
import Button from "@/components/ui/button";
import Separator from "@/components/ui/separator";
import Feed from "@/components/feed";
import UploadModal from "@/components/upload-modal";
import Dialog from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

async function listFeed() {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/icebreakers?limit=20&offset=0&type=all`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load feed");
  const data = await res.json();
  return Array.isArray(data) ? data : data.items || [];
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
    if (loading) return;
    setLoading(true);

    try {
      const isPdf = !!(form.file && (form.file.type?.includes("pdf") || /\.pdf$/i.test(form.file.name)));
      const url = isPdf
        ? `${BACKEND_URL}/api/v1/generate-icebreaker-from-pdf`
        : `${BACKEND_URL}/api/v1/generate-icebreaker`;

      const fd = new FormData();
      fd.append("person", form.person || "");
      fd.append("role", form.role || "");
      fd.append("company", form.company || "");
      fd.append("linkedinBio", form.linkedinBio || "");
      if (form.deckText) fd.append("deckText", form.deckText);
      if (isPdf && form.file) fd.append("pitchDeck", form.file, form.file.name);

      const res = await fetch(url, { method: "POST", body: fd });
      await res.json().catch(() => null);
    } catch (err) {
      console.error(err);
    }

    // After creation, refresh feed from DB
    try {
      const list = await listFeed();
      setItems(list);
      addToast({ title: "Icebreaker created", variant: "success" });
    } catch {}
    setForm({ person: "", role: "", company: "", linkedinBio: "", deckText: "", pitchDeck: "", file: null });
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">LinkedIn Icebreaker</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Paste a LinkedIn bio and add a pitch deck (paste or upload). Results
        will appear below.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="person">Name</Label>
            <Input
              id="person"
              name="person"
              value={form.person}
              onChange={onChange}
              placeholder="e.g., Priya Sharma"
              required
            />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              name="role"
              value={form.role}
              onChange={onChange}
              placeholder="e.g., Head of Sales"
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
              placeholder="e.g., Acme Inc."
              required
            />
          </div>
        </div>
        <div>
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
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="deckText">Pitch Deck</Label>
            <Button
              type="button"
              variant="outline"
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
            required
          />
          {form.deckSource ? (
            <p className="mt-1 text-xs text-zinc-500">
              Source: {form.deckSource}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="submit" loading={loading} disabled={loading}>
            {loading ? "Generating" : "Generate & Save"}
          </Button>
        </div>
      </form>

      <Separator />
      <h2 className="mb-3 text-lg font-medium">Feed</h2>
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
import { BACKEND_URL } from "@/lib/config";
