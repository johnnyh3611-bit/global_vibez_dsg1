/**
 * /artist/music-group — Rights Ledger + Collaborator Splits panel.
 *
 * Companion page to /artist/dashboard. Per-track:
 *   • toggle sync rights (TV / casino background / commercial)
 *   • configure collaborator basis-point splits (must sum to 10,000)
 *   • view recent collective royalty payouts
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Music, ChevronLeft, Plus, Trash2, Users, Coins,
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '';
const token = () => localStorage.getItem('auth_token') || '';
const fmt = (n: number | undefined) => (n ?? 0).toLocaleString('en-US');

type Track = { track_id: string; title: string };
type Rights = {
  allow_tv_sync: boolean;
  allow_casino_background: boolean;
  allow_commercial_use: boolean;
  default?: boolean;
};
type Split = { user_id: string; role: string; basis_points: number };
type Payout = {
  payout_id: string; track_id: string; track_title?: string;
  payout_coins: number; collaborator_count: number; at: string;
  burn_coins: number;
};

export default function MusicGroupArtistPanel() {
  const navigate = useNavigate();
  const auth = useMemo(() => ({ Authorization: `Bearer ${token()}` }), []);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<string>('');
  const [rights, setRights] = useState<Rights | null>(null);
  const [splits, setSplits] = useState<Split[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [busy, setBusy] = useState(false);
  const [draftSplits, setDraftSplits] = useState<Split[]>([]);

  const totalBps = useMemo(
    () => draftSplits.reduce((sum, s) => sum + (s.basis_points || 0), 0),
    [draftSplits],
  );

  // 1. Load owned tracks
  const fetchTracks = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/media/artist/me/tracks`, { headers: auth });
      const d = await r.json();
      const rows: Track[] = (d?.tracks || d?.rows || []).map((t: any) => ({
        track_id: t.track_id, title: t.title,
      }));
      setTracks(rows);
      if (rows.length && !selectedTrack) setSelectedTrack(rows[0].track_id);
    } catch (e) {
      // Non-fatal — keep panel usable.
    }
  }, [auth, selectedTrack]);

  const fetchPayouts = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/music-group/royalty/me`, { headers: auth });
      const d = await r.json();
      setPayouts(d?.rows || []);
    } catch {}
  }, [auth]);

  const fetchTrackDetail = useCallback(async (tid: string) => {
    if (!tid) return;
    try {
      const [r, s] = await Promise.all([
        fetch(`${API}/api/music-group/rights/${tid}`).then(r => r.json()),
        fetch(`${API}/api/music-group/splits/${tid}`).then(r => r.json()),
      ]);
      setRights(r);
      const rows: Split[] = s?.rows || [];
      setSplits(rows);
      setDraftSplits(rows.length ? rows : [{ user_id: '', role: 'primary_artist', basis_points: 10_000 }]);
    } catch {}
  }, []);

  useEffect(() => { fetchTracks(); fetchPayouts(); }, [fetchTracks, fetchPayouts]);
  useEffect(() => { fetchTrackDetail(selectedTrack); }, [selectedTrack, fetchTrackDetail]);

  // Toggle rights
  const saveRights = async (next: Partial<Rights>) => {
    if (!selectedTrack) return;
    setBusy(true);
    try {
      const body = {
        track_id: selectedTrack,
        allow_tv_sync: next.allow_tv_sync ?? rights?.allow_tv_sync ?? false,
        allow_casino_background: next.allow_casino_background ?? rights?.allow_casino_background ?? false,
        allow_commercial_use: next.allow_commercial_use ?? rights?.allow_commercial_use ?? false,
      };
      const r = await fetch(`${API}/api/music-group/rights/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d?.ok) {
        setRights({ ...rights, ...body } as Rights);
        toast.success('Rights saved');
      } else toast.error(d?.reason || 'Save failed');
    } finally { setBusy(false); }
  };

  const updateDraft = (idx: number, patch: Partial<Split>) => {
    setDraftSplits(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const addCollaborator = () => {
    setDraftSplits(prev => [...prev, { user_id: '', role: 'collaborator', basis_points: 0 }]);
  };

  const removeCollaborator = (idx: number) => {
    setDraftSplits(prev => prev.filter((_, i) => i !== idx));
  };

  const saveSplits = async () => {
    if (!selectedTrack) return;
    if (totalBps !== 10_000) {
      toast.error(`Basis points must sum to 10,000 (current ${totalBps})`);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/music-group/splits/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          track_id: selectedTrack,
          splits: draftSplits.filter(s => s.user_id.trim()),
        }),
      });
      const d = await r.json();
      if (d?.ok) {
        setSplits(draftSplits);
        toast.success('Splits saved');
      } else toast.error(d?.reason || 'Save failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#06080f] text-white" data-testid="music-group-panel">
      <header className="sticky top-0 z-20 px-5 py-4 border-b border-purple-400/20 backdrop-blur-md bg-[#06080f]/95">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/artist/dashboard')}
            className="text-sm flex items-center gap-2 text-white/70 hover:text-white"
            data-testid="music-group-back"
          >
            <ChevronLeft className="w-4 h-4" /> Studio
          </button>
          <h1 className="text-base sm:text-lg font-black tracking-widest text-purple-300">
            DSG MUSIC GROUP
          </h1>
          <span className="text-[10px] uppercase font-bold text-purple-400/70">
            80/15/5 · NO BURN
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6 space-y-5">
        {/* Track picker */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <label className="text-[10px] uppercase tracking-widest text-white/40 mb-2 block">
            Pick a track
          </label>
          <select
            value={selectedTrack}
            onChange={e => setSelectedTrack(e.target.value)}
            data-testid="track-picker"
            className="w-full rounded-lg border border-white/10 bg-[#0a0a14] px-3 py-2 text-sm"
          >
            {tracks.length === 0 && <option value="">(no tracks — drop one first)</option>}
            {tracks.map(t => (
              <option key={t.track_id} value={t.track_id}>{t.title}</option>
            ))}
          </select>
        </div>

        {/* Rights */}
        <section className="rounded-2xl border border-purple-400/40 bg-purple-950/20 p-5" data-testid="rights-section">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-purple-200 mb-3">
            <Music className="w-4 h-4" /> Sync Rights
          </h2>
          <div className="grid sm:grid-cols-3 gap-2">
            {(['allow_tv_sync', 'allow_casino_background', 'allow_commercial_use'] as const).map(field => (
              <label
                key={field}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 cursor-pointer"
              >
                <span className="text-xs">{field.replace('allow_', '').replaceAll('_', ' ')}</span>
                <input
                  type="checkbox"
                  checked={!!rights?.[field]}
                  onChange={e => saveRights({ [field]: e.target.checked })}
                  disabled={busy || !selectedTrack}
                  data-testid={`rights-${field}`}
                />
              </label>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-white/40">
            Off-chain ledger written to <code className="font-mono text-purple-300">tracks_rights_ledger</code> —
            the Master Media Engine + DSG TV check this before playback in any of these contexts.
          </p>
        </section>

        {/* Collaborator Splits */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5" data-testid="splits-section">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white/80 mb-3">
            <Users className="w-4 h-4" /> Collaborator Splits ({totalBps}/10,000 bps)
          </h2>
          <ul className="space-y-2">
            {draftSplits.map((s, idx) => (
              <li key={idx} className="flex items-center gap-2" data-testid={`split-row-${idx}`}>
                <input
                  value={s.user_id}
                  onChange={e => updateDraft(idx, { user_id: e.target.value })}
                  placeholder="collaborator user_id"
                  data-testid={`split-userid-${idx}`}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                />
                <input
                  value={s.role}
                  onChange={e => updateDraft(idx, { role: e.target.value })}
                  placeholder="role"
                  data-testid={`split-role-${idx}`}
                  className="w-28 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                />
                <input
                  type="number"
                  value={s.basis_points}
                  onChange={e => updateDraft(idx, { basis_points: parseInt(e.target.value) || 0 })}
                  data-testid={`split-bps-${idx}`}
                  className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-right"
                />
                <button
                  onClick={() => removeCollaborator(idx)}
                  data-testid={`remove-split-${idx}`}
                  className="p-2 rounded-lg border border-white/10 hover:bg-white/5"
                >
                  <Trash2 className="w-3 h-3 text-rose-300" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-3">
            <button
              onClick={addCollaborator}
              data-testid="add-collaborator-btn"
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-xs"
            >
              <Plus className="w-3 h-3" /> Add collaborator
            </button>
            <button
              onClick={saveSplits}
              disabled={busy || totalBps !== 10_000 || !selectedTrack}
              data-testid="save-splits-btn"
              className={`ml-auto px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest ${
                totalBps === 10_000
                  ? 'bg-purple-400 hover:bg-purple-300 text-black'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
              } disabled:opacity-50`}
            >
              Save Splits
            </button>
          </div>
          <p className="mt-2 text-[10px] text-white/40">
            Basis-point invariant: every row's bps must sum to <span className="text-purple-300 font-bold">10,000</span>.
            The 80% artist slice of every fan payment is sub-divided pro-rata.
          </p>
        </section>

        {/* Recent payouts */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5" data-testid="royalty-section">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-emerald-200 mb-3">
            <Coins className="w-4 h-4" /> Recent Collective Royalty
          </h2>
          {payouts.length === 0 ? (
            <p className="text-xs text-white/40">No collective payouts yet.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {payouts.map(p => (
                <li key={p.payout_id}
                    data-testid={`royalty-row-${p.payout_id}`}
                    className="flex items-center gap-3 border-t border-white/5 py-2">
                  <span className="font-mono text-emerald-300">{p.payout_id}</span>
                  <span className="text-white/70 truncate">{p.track_title || p.track_id}</span>
                  <span className="ml-auto text-white">{fmt(p.payout_coins)} ₵</span>
                  <span className="text-white/40">· {p.collaborator_count} splits</span>
                  <span className="text-rose-200 font-bold">burn {fmt(p.burn_coins)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
