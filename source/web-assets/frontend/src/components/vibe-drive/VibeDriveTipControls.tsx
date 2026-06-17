/**
 * VibeDriveTipControls — passenger-facing tip-to-skip / tip-to-add buttons.
 *
 * Spotify ladder step 3 (2026-02-06):
 *   POST /api/vibe-drive/tip-skip  (100 ₵)
 *   POST /api/vibe-drive/tip-add   (50 ₵, requires track URI)
 *
 * Drop into any in-ride view that has rideId + driverUserId in scope.
 * If a track URI is staged (`addTrackUri`), the Tip-to-Add button is
 * enabled. Otherwise only Tip-to-Skip is available.
 */
import { useState } from "react";
import { Forward, Plus, Loader2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const TIP_SKIP_COST = 100;
const TIP_ADD_COST = 50;

const authHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const token = localStorage.getItem("auth_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } catch {
    /* ignore */
  }
  return headers;
};

type Props = {
  rideId: string;
  driverUserId: string;
  addTrackUri?: string | null;
  addTrackLabel?: string | null;
  onAfterTip?: (kind: "tip_skip" | "tip_add", payload: unknown) => void;
};

export const VibeDriveTipControls = ({
  rideId,
  driverUserId,
  addTrackUri,
  addTrackLabel,
  onAfterTip,
}: Props) => {
  const [busy, setBusy] = useState<"tip_skip" | "tip_add" | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const post = async (path: string, body: Record<string, unknown>): Promise<unknown> => {
    const res = await fetch(`${API}/api/vibe-drive/${path}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `${res.status}`);
    }
    return res.json();
  };

  const onTipSkip = async () => {
    if (busy || !rideId || !driverUserId) return;
    setBusy("tip_skip");
    setResult(null);
    try {
      const data = await post("tip-skip", { ride_id: rideId, driver_user_id: driverUserId });
      setResult(`Skipped · ${TIP_SKIP_COST} ₵ debited`);
      onAfterTip?.("tip_skip", data);
    } catch (e) {
      setResult(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const onTipAdd = async () => {
    if (busy || !rideId || !driverUserId || !addTrackUri) return;
    setBusy("tip_add");
    setResult(null);
    try {
      const data = await post("tip-add", {
        ride_id: rideId,
        driver_user_id: driverUserId,
        track_uri: addTrackUri,
      });
      setResult(`Queued · ${TIP_ADD_COST} ₵ debited`);
      onAfterTip?.("tip_add", data);
    } catch (e) {
      setResult(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-fuchsia-500/30 bg-black/40 p-3"
      data-testid="vibe-drive-tip-controls"
    >
      <div className="text-[11px] uppercase tracking-wide text-fuchsia-300/80 font-bold">
        Tip the DJ
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onTipSkip}
          disabled={busy !== null}
          data-testid="tip-skip-btn"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-500/15 border border-rose-500/40 px-3 py-2 text-sm font-bold text-rose-200 hover:bg-rose-500/30 disabled:opacity-50"
        >
          {busy === "tip_skip" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Forward className="w-4 h-4" />}
          Tip-to-Skip <span className="text-xs opacity-80">{TIP_SKIP_COST} ₵</span>
        </button>
        <button
          type="button"
          onClick={onTipAdd}
          disabled={busy !== null || !addTrackUri}
          data-testid="tip-add-btn"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-3 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
        >
          {busy === "tip_add" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Tip-to-Add <span className="text-xs opacity-80">{TIP_ADD_COST} ₵</span>
        </button>
      </div>
      {addTrackLabel && (
        <div className="text-[11px] text-emerald-300/70 truncate" data-testid="tip-add-track-label">
          Adding: {addTrackLabel}
        </div>
      )}
      {result && (
        <div className="text-[11px] text-slate-300" data-testid="vibe-drive-tip-result">
          {result}
        </div>
      )}
    </div>
  );
};

export default VibeDriveTipControls;
