/**
 * Tiny helpers used by route aliases so preference writes happen before
 * Navigate, without mounting full page shells.
 */
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import {
  switchDashboardView,
  type DashboardView,
} from "@/pages/DashboardRouter";

export function DashboardViewRedirect({ view }: { view: DashboardView }) {
  useEffect(() => {
    switchDashboardView(view);
  }, [view]);
  return <Navigate to="/dashboard" replace />;
}
