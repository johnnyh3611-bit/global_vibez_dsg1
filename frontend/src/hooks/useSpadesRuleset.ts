/**
 * useSpadesRuleset — small hook that backs SpadesRulesetPicker with
 * persistent per-user state. Mirrors the shape of useTableStyle but for
 * gameplay rules, not cosmetics.
 *
 *   const { ruleset, setRuleset } = useSpadesRuleset();
 *   <SpadesRulesetPicker value={ruleset} onChange={setRuleset} />
 *
 * GET/PUT /api/preferences/spades-ruleset. Anonymous users fall back to
 * localStorage so the choice persists across sessions even before login.
 */
import { useEffect, useState, useCallback } from "react";
import { authFetch, getUserId } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;
const LOCAL_KEY = "spades_ruleset_local_v1";

export type SpadesRulesetId = "CLASSIC" | "BIG_WHEEL";

const VALID: SpadesRulesetId[] = ["CLASSIC", "BIG_WHEEL"];

export function useSpadesRuleset() {
  const [ruleset, setRulesetState] = useState<SpadesRulesetId>("CLASSIC");

  const load = useCallback(async () => {
    if (!getUserId()) {
      const local = localStorage.getItem(LOCAL_KEY) as SpadesRulesetId | null;
      if (local && VALID.includes(local)) setRulesetState(local);
      return;
    }
    try {
      const r = await authFetch(`${API}/api/preferences/spades-ruleset`);
      if (!r.ok) return;
      const d = await r.json();
      if (d.ruleset && VALID.includes(d.ruleset as SpadesRulesetId)) {
        setRulesetState(d.ruleset);
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setRuleset = async (next: SpadesRulesetId) => {
    setRulesetState(next);
    if (!getUserId()) {
      localStorage.setItem(LOCAL_KEY, next);
      return;
    }
    try {
      await authFetch(`${API}/api/preferences/spades-ruleset`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleset: next }),
      });
    } catch {
      /* silent — local state already updated */
    }
  };

  return { ruleset, setRuleset };
}
