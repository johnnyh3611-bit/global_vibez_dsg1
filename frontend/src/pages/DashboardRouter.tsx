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
 *
 * 2026-05-12 bug fix: the toggle buttons (`dashboard-try-volumetric` +
 * `vol-back-classic`) were calling `localStorage.setItem(...)` followed by
 * `navigate('/dashboard')`. Both happen to land you BACK on /dashboard, so
 * React Router treats it as a no-op and doesn't re-render. The `storage`
 * event by spec ONLY fires in OTHER tabs, not the tab that performed the
 * write. Focus event only fires when the window loses/regains focus.
 * Net result: clicking the toggle did absolutely nothing.
 *
 * Fix: export a `switchDashboardView()` helper that BOTH writes localStorage
 * AND dispatches a custom `gv-dashboard-view` event on `window`. The router
 * listens for it and re-reads the preference. Same-tab toggling now works
 * instantly. Cross-tab (`storage`) and tab-refocus (`focus`) listeners are
 * preserved for free.
 */
import { useState, useEffect } from "react";
import VolumetricDashboard from "@/pages/VolumetricDashboard";
import Dashboard from "@/pages/DashboardNew";

export const DASHBOARD_VIEW_KEY = "gv_dashboard_view";
export const DASHBOARD_VIEW_EVENT = "gv-dashboard-view";
export type DashboardView = "volumetric" | "classic";

export function getDashboardView(): DashboardView {
  if (typeof window === "undefined") return "volumetric";
  const v = localStorage.getItem(DASHBOARD_VIEW_KEY);
  // Default to volumetric (founder ask) when no preference is recorded.
  return v === "classic" ? "classic" : "volumetric";
}

/**
 * Persist + broadcast a dashboard view switch. Call this from EVERY toggle
 * button so the router re-renders without a full page reload.
 */
export function switchDashboardView(view: DashboardView): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DASHBOARD_VIEW_KEY, view);
  window.dispatchEvent(new CustomEvent(DASHBOARD_VIEW_EVENT, { detail: view }));
}

export default function DashboardRouter() {
  const [view, setView] = useState<DashboardView>(() => getDashboardView());

  // React to same-tab toggle clicks via our custom event.
  useEffect(() => {
    const onSwitch = () => setView(getDashboardView());
    window.addEventListener(DASHBOARD_VIEW_EVENT, onSwitch);
    return () => window.removeEventListener(DASHBOARD_VIEW_EVENT, onSwitch);
  }, []);

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
