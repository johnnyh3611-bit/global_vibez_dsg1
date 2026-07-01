/**
 * Vibez654ReachabilityChip — Dashboard-style indicator showing how
 * many Vibez 6-5-4 variants are reachable from the Hall right now.
 *
 * Self-updating: derives the count directly from a manifest that
 * mirrors the Hall's VARIANTS table. When a new variant is added,
 * update VARIANTS_MANIFEST here AND in the Hall — a regression test
 * guards that the two stay in sync.
 *
 * Click → navigates to /vibe-654-hall so the user can walk every room.
 */
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle } from 'lucide-react';

// Mirror of /pages/games/Vibe654Hall.tsx VARIANTS table.
// Order: id, label, status. A regression test guards this stays
// in sync with the Hall.
export const VARIANTS_MANIFEST: Array<{ id: string; label: string; status: 'live' | 'ephemeral' | 'backend-only' }> = [
  { id: 'classic', label: 'Classic Parlour', status: 'live' },
  { id: 'premium', label: 'Premium Table', status: 'live' },
  { id: 'solo', label: 'Solo Vault', status: 'live' },
  { id: 'lobby', label: 'Tournament Lobby', status: 'live' },
  { id: 'coliseum', label: 'Breadwinner Coliseum', status: 'ephemeral' },
  { id: 'legacy-table', label: 'Legacy Tournament Table', status: 'ephemeral' },
  { id: 'prescription', label: 'Prescription (Sovereign)', status: 'live' },
];

export default function Vibez654ReachabilityChip() {
  const navigate = useNavigate();
  const total = VARIANTS_MANIFEST.length;
  // 'live' AND 'ephemeral' both count as reachable (ephemeral just
  // needs the Hall's auto-create-test-table button to enter).
  // Only 'backend-only' is genuinely unreachable from UI.
  const reachable = VARIANTS_MANIFEST.filter((v) => v.status !== 'backend-only').length;
  const allReachable = reachable === total;

  return (
    <button
      type="button"
      onClick={() => navigate('/vibe-654-hall')}
      data-testid="vibez-654-reachability-chip"
      title={`Vibez 6-5-4 Hall: ${reachable} of ${total} variants reachable`}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] md:text-xs font-bold uppercase tracking-widest transition-colors ${
        allReachable
          ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/20'
          : 'bg-amber-500/10 border-amber-400/40 text-amber-200 hover:bg-amber-500/20'
      }`}
    >
      {allReachable ? (
        <CheckCircle2 className="w-3.5 h-3.5" />
      ) : (
        <AlertCircle className="w-3.5 h-3.5" />
      )}
      <span data-testid="vibez-654-reachability-text">
        Hall: {reachable}/{total}
      </span>
    </button>
  );
}
