/**
 * DashboardRouter — chooses which dashboard the user lands on at /dashboard.
 *
 * 2026-05-12 founder ask: "I would like the volumetric galaxy view to be
 * the view that people come into the page and get, where they have an
 * option at the top to change it to the classic view."
 *
 * Default: Volumetric Galaxy. Users can switch from either view; their
 * preference persists via localStorage.
 *
 * Storage key: `gv_dashboard_view` = "volumetric" | "classic"
 */
import { useState, useEffect } from "react";
import VolumetricDashboard from "@/pages/VolumetricDashboard";
import Dashboard from "@/pages/DashboardNew";

export const DASHBOARD_VIEW_KEY = "gv_dashboard_view";
export type DashboardView = "volumetric" | "classic";

export function getDashboardView(): DashboardView {
  if (typeof window === "undefined") return "volumetric";
  const v = localStorage.getItem(DASHBOARD_VIEW_KEY);
  // Default to volumetric (founder ask) when no preference is recorded.
  return v === "classic" ? "classic" : "volumetric";
}

export function setDashboardView(view: DashboardView): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(DASHBOARD_VIEW_KEY, view);
  }
}

export default function DashboardRouter() {
  const [view, setView] = useState<DashboardView>(() => getDashboardView());

  // React to cross-tab preference changes (e.g. user toggled in another tab).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DASHBOARD_VIEW_KEY) {
        setView(getDashboardView());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Also re-read on focus — handles in-tab toggles that didn't fire 'storage'.
  useEffect(() => {
    const onFocus = () => setView(getDashboardView());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return view === "classic" ? <Dashboard /> : <VolumetricDashboard />;
}
