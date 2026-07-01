/**
 * RoomVisitLogger — globally mounts a route-change listener that pings
 * /api/recent-rooms/log every time the user enters a tracked room.
 *
 * The backend handles cooldown (5s per user/path) so React StrictMode
 * double-fires don't double-count.
 *
 * Anonymous routes (no auth token) are silently skipped.
 */
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { matchInfo } from "@/data/roomInfo";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

// Reverse map: room path → which Volumetric category it belongs to.
const PATH_TO_CATEGORY: Record<string, string> = {
  "/spades": "games", "/vibez-654": "games", "/chess-hall": "games",
  "/underground-casino": "games", "/cyber-casino": "games",
  "/baccarat": "games", "/practice/play/blackjack": "games",
  "/bid-whist": "games", "/hearts": "games",
  "/dating": "dating", "/matchmaking": "dating",
  "/cinema-room": "dating", "/vibe-spots": "dating", "/speed-dating": "dating",
  "/vibe-ridez": "rides", "/vibe-drive": "rides",
  "/hungryvibes": "food", "/yellow-pages": "food", "/receipts": "food",
  "/live": "streaming", "/underground-live": "streaming",
  "/sports-lounge": "streaming", "/dsg/memory-bank": "streaming",
  "/dsg/beat-vault": "streaming",
  "/lottery": "vault", "/tiers": "vault", "/wallet": "vault",
  "/chair-hall": "vault", "/voice-mirror": "vault",
};

// Best-effort emoji for a room (mirrors VolumetricDashboard's labels).
const PATH_TO_EMOJI: Record<string, string> = {
  "/spades": "♠️", "/vibez-654": "🎲", "/chess-hall": "♟️",
  "/underground-casino": "🃏", "/cyber-casino": "🎰",
  "/dating": "💞", "/matchmaking": "✨", "/cinema-room": "🎬",
  "/vibe-spots": "📍", "/vibe-ridez": "🚗",
  "/hungryvibes": "🍕", "/yellow-pages": "📒", "/receipts": "🧾",
  "/live": "📡", "/underground-live": "🎤", "/sports-lounge": "🏆",
  "/dsg/memory-bank": "🎞️", "/dsg/beat-vault": "🎧",
  "/lottery": "🎰", "/tiers": "👑", "/wallet": "💰",
  "/chair-hall": "🪑", "/voice-mirror": "🎙️",
};

function bestPrefix(path: string): string | null {
  // Longest-prefix match against PATH_TO_CATEGORY.
  const keys = Object.keys(PATH_TO_CATEGORY).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (path === k || path.startsWith(k + "/") || path.startsWith(k + "?")) {
      return k;
    }
  }
  return null;
}

export default function RoomVisitLogger() {
  const { pathname } = useLocation();
  const lastLogged = useRef<string | null>(null);

  useEffect(() => {
    const prefix = bestPrefix(pathname);
    if (!prefix) return;
    if (lastLogged.current === pathname) return;
    lastLogged.current = pathname;

    const info = matchInfo(pathname);
    const body = {
      path: prefix,
      category: PATH_TO_CATEGORY[prefix],
      label: info?.title ?? prefix,
      emoji: PATH_TO_EMOJI[prefix] ?? "✦",
    };
    // Fire-and-forget; backend handles cooldown + auth gating.
    authFetch(`${API}/api/recent-rooms/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => { /* swallow */ });
  }, [pathname]);

  return null;
}
