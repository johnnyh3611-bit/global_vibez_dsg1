/**
 * useTableStyle — small hook + CSS class generator for per-user
 * card-table cosmetic preferences. Drop into any game page:
 *
 *   const { style, className } = useTableStyle();
 *   <div className={className}>...</div>
 *
 * Backend: GET/PUT /api/preferences/table-style. Anonymous users fall
 * back to localStorage so unsigned-in browsing still feels personalized.
 */
import { useEffect, useState, useCallback } from "react";
import { authFetch, getUserId } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;
const LOCAL_KEY = "table_style_local_v1";

export const TABLE_STYLES = [
  { id: "celestial", label: "Celestial",  hint: "Cyan grid · default" },
  { id: "neon",      label: "Neon Floor", hint: "Magenta + lime accents" },
  { id: "cherry",    label: "Cherry",     hint: "Crimson velvet" },
  { id: "midnight",  label: "Midnight",   hint: "Deep navy + chrome" },
  { id: "royal",     label: "Royal",      hint: "Gold + emerald" },
] as const;

export type TableStyleId = (typeof TABLE_STYLES)[number]["id"];

const STYLE_TO_CLASS: Record<TableStyleId, string> = {
  celestial: "table-style-celestial",
  neon:      "table-style-neon",
  cherry:    "table-style-cherry",
  midnight:  "table-style-midnight",
  royal:     "table-style-royal",
};

export function useTableStyle() {
  const [style, setStyleState] = useState<TableStyleId>("celestial");

  const load = useCallback(async () => {
    if (!getUserId()) {
      const local = localStorage.getItem(LOCAL_KEY) as TableStyleId | null;
      if (local && STYLE_TO_CLASS[local]) setStyleState(local);
      return;
    }
    try {
      const r = await authFetch(`${API}/api/preferences/table-style`);
      if (!r.ok) return;
      const d = await r.json();
      if (d.style && STYLE_TO_CLASS[d.style as TableStyleId]) {
        setStyleState(d.style);
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStyle = async (next: TableStyleId) => {
    setStyleState(next);
    if (!getUserId()) {
      localStorage.setItem(LOCAL_KEY, next);
      return;
    }
    try {
      await authFetch(`${API}/api/preferences/table-style`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: next }),
      });
    } catch {
      /* silent — local state already updated */
    }
  };

  return {
    style,
    className: STYLE_TO_CLASS[style],
    setStyle,
    options: TABLE_STYLES,
  };
}
