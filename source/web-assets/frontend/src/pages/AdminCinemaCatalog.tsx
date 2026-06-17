/**
 * /admin/cinema-catalog — Admin UI for editing the Cinema Room catalog
 * without a redeploy (founder ask 2026-05-10, was P3 backlog).
 *
 * Lists all current catalog items + lets admins ADD/UPDATE/DELETE.
 * Backed by /api/cinema-room/admin/catalog. Soft-deletes hide the
 * static seed; new rows are stored in `cinema_catalog_overrides`.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Save, Trash2, Loader2, Film } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type CatalogItem = {
  id: string;
  title: string;
  year: number;
  duration_min: number;
  source: string;
  url: string;
  thumbnail?: string;
  genre?: string[];
  rating?: string;
  license?: string;
};

const EMPTY: CatalogItem = {
  id: "",
  title: "",
  year: new Date().getFullYear(),
  duration_min: 90,
  source: "archive_org",
  url: "",
  thumbnail: "",
  genre: [],
  rating: "PG",
  license: "Public Domain",
};

export default function AdminCinemaCatalog() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<CatalogItem>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/cinema-room/catalog`);
      const d = await r.json();
      setItems((d?.items as CatalogItem[]) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await authFetch(`${API}/api/cinema-room/admin/catalog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          genre: typeof draft.genre === "string" ? (draft.genre as any).split(",").map((g: string) => g.trim()).filter(Boolean) : draft.genre,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.detail || "Save failed");
      setDraft(EMPTY);
      setEditing(null);
      await refresh();
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(`Delete "${id}" from the catalog?`)) return;
    setBusy(true);
    try {
      const r = await authFetch(`${API}/api/cinema-room/admin/catalog/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d?.detail || "Delete failed");
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (item: CatalogItem) => {
    setDraft({ ...item, genre: item.genre || [] });
    setEditing(item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#0a0810] text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="text-sm flex items-center gap-2 text-white/70 hover:text-white" data-testid="admin-cinema-back">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-base md:text-xl tracking-[0.3em] uppercase text-amber-200 flex items-center gap-2">
          <Film className="w-5 h-5" /> Cinema Catalog · Admin
        </h1>
        <div className="text-[10px] uppercase tracking-widest text-white/40 hidden md:block">{items.length} films</div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Add / edit form */}
        <div className="rounded-2xl bg-black/60 border border-white/10 p-5 mb-6" data-testid="admin-cinema-form">
          <h2 className="text-sm uppercase tracking-widest text-amber-300 mb-4 flex items-center gap-2">
            {editing ? "Edit film" : "Add new film"}
          </h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="col-span-2">
              <span className="text-white/60">ID (slug)</span>
              <input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} disabled={!!editing} placeholder="ar-rear-window-1954" className="mt-1 w-full rounded bg-black/50 border border-white/10 px-2 py-1.5 disabled:opacity-50" data-testid="admin-cinema-id" />
            </label>
            <label className="col-span-2">
              <span className="text-white/60">Title</span>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Rear Window (1954)" className="mt-1 w-full rounded bg-black/50 border border-white/10 px-2 py-1.5" data-testid="admin-cinema-title" />
            </label>
            <label>
              <span className="text-white/60">Year</span>
              <input type="number" value={draft.year} onChange={(e) => setDraft({ ...draft, year: parseInt(e.target.value, 10) || 0 })} className="mt-1 w-full rounded bg-black/50 border border-white/10 px-2 py-1.5" data-testid="admin-cinema-year" />
            </label>
            <label>
              <span className="text-white/60">Duration (min)</span>
              <input type="number" value={draft.duration_min} onChange={(e) => setDraft({ ...draft, duration_min: parseInt(e.target.value, 10) || 0 })} className="mt-1 w-full rounded bg-black/50 border border-white/10 px-2 py-1.5" data-testid="admin-cinema-duration" />
            </label>
            <label className="col-span-2">
              <span className="text-white/60">Direct MP4 URL</span>
              <input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://archive.org/download/...mp4" className="mt-1 w-full rounded bg-black/50 border border-white/10 px-2 py-1.5" data-testid="admin-cinema-url" />
            </label>
            <label className="col-span-2">
              <span className="text-white/60">Thumbnail URL</span>
              <input value={draft.thumbnail || ""} onChange={(e) => setDraft({ ...draft, thumbnail: e.target.value })} placeholder="https://archive.org/services/img/..." className="mt-1 w-full rounded bg-black/50 border border-white/10 px-2 py-1.5" data-testid="admin-cinema-thumb" />
            </label>
            <label>
              <span className="text-white/60">Genres (comma)</span>
              <input value={Array.isArray(draft.genre) ? draft.genre.join(", ") : (draft.genre || "")} onChange={(e) => setDraft({ ...draft, genre: e.target.value as any })} placeholder="Horror, Classic" className="mt-1 w-full rounded bg-black/50 border border-white/10 px-2 py-1.5" data-testid="admin-cinema-genre" />
            </label>
            <label>
              <span className="text-white/60">Rating</span>
              <input value={draft.rating || "PG"} onChange={(e) => setDraft({ ...draft, rating: e.target.value })} className="mt-1 w-full rounded bg-black/50 border border-white/10 px-2 py-1.5" data-testid="admin-cinema-rating" />
            </label>
          </div>
          {error && <p className="text-rose-300 text-xs mt-3" data-testid="admin-cinema-error">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={save} disabled={busy || !draft.id || !draft.title || !draft.url} data-testid="admin-cinema-save" className="px-4 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-xs font-black uppercase tracking-widest disabled:opacity-40 inline-flex items-center gap-1.5">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : editing ? <Save className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              {editing ? "Update" : "Add"}
            </button>
            {editing && (
              <button onClick={() => { setDraft(EMPTY); setEditing(null); }} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-xs uppercase tracking-widest" data-testid="admin-cinema-cancel">
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <p className="text-white/40 text-xs flex items-center gap-2 justify-center"><Loader2 className="w-3 h-3 animate-spin" /> Loading catalog…</p>
        ) : (
          <ul className="space-y-2" data-testid="admin-cinema-list">
            {items.map((it) => (
              <li key={it.id} data-testid={`admin-cinema-row-${it.id}`} className="flex items-center justify-between rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white truncate">{it.title}</p>
                  <p className="text-white/40 truncate font-mono">{it.id} · {it.year} · {it.duration_min}min · {it.rating}</p>
                </div>
                <div className="flex gap-1.5 ml-3">
                  <button onClick={() => startEdit(it)} data-testid={`admin-cinema-edit-${it.id}`} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] uppercase tracking-widest">Edit</button>
                  <button onClick={() => remove(it.id)} data-testid={`admin-cinema-delete-${it.id}`} className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[10px] uppercase tracking-widest inline-flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Del
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
