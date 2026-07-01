/**
 * useChairPerks — Roadmap PDF §3 "Seated Ownership."
 *
 * Returns the caller's chair-holder perk payload from
 * GET /api/chairs/perks. Used by <ChairHolderName /> to colorize chat
 * usernames + by reward UIs to display the +10% boost badge.
 *
 * Silently returns `{owns_chair: false}` when unauthenticated or the
 * endpoint fails — never throws so callers can mount it everywhere
 * without try/catch.
 */
import { useEffect, useState } from "react";

export interface ChairPerks {
  owns_chair: boolean;
  locked_chairs: number;
  generation_boost_pct: number;
  name_color: string;   // hex like "#22d3ee"
  glow_color: string;   // rgba glow string
  badge_label: string;  // "Founder" | "Genius" | "Standard" | ""
}

const FALLBACK: ChairPerks = {
  owns_chair: false,
  locked_chairs: 0,
  generation_boost_pct: 0,
  name_color: "",
  glow_color: "",
  badge_label: "",
};

const API = process.env.REACT_APP_BACKEND_URL;

let _cache: ChairPerks | null = null;
let _inflight: Promise<ChairPerks> | null = null;

async function fetchPerks(): Promise<ChairPerks> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  const token = typeof window !== "undefined"
    ? (localStorage.getItem("auth_token") || localStorage.getItem("session_token"))
    : null;
  if (!token) return FALLBACK;
  _inflight = (async () => {
    try {
      const res = await fetch(`${API}/api/chairs/perks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return FALLBACK;
      const data = (await res.json()) as ChairPerks;
      _cache = data;
      return data;
    } catch {
      return FALLBACK;
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

export function useChairPerks(): ChairPerks {
  const [perks, setPerks] = useState<ChairPerks>(_cache || FALLBACK);
  useEffect(() => {
    let mounted = true;
    fetchPerks().then((p) => mounted && setPerks(p));
    return () => {
      mounted = false;
    };
  }, []);
  return perks;
}

/** Test-only escape hatch — clears the in-memory cache so unit tests
 *  can re-mount the hook with a different fixture. */
export function __resetChairPerksCache() {
  _cache = null;
  _inflight = null;
}
