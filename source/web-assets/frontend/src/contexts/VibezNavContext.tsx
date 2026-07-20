/**
 * VibezNavContext — shared subject filter + sidebar collapse state.
 * Pages listen via useVibezSubject() instead of mounting horizontal tabs.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  activityFeedForPlanet,
  defaultSubjectId,
  detectPlanet,
  PLANET_LINKS,
  planetLabel,
  subjectsForPlanet,
  type VibezActivityItem,
  type VibezPlanet,
  type VibezSubject,
} from "@/components/layout/vibezSubjects";

const COLLAPSE_KEY = "gv_vibez_sidebar_collapsed";

export interface VibezNavContextValue {
  planet: VibezPlanet;
  planetTitle: string;
  subjects: VibezSubject[];
  planetLinks: VibezSubject[];
  activity: VibezActivityItem[];
  subjectId: string;
  setSubjectId: (id: string) => void;
  selectSubject: (subject: VibezSubject) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  toggleCollapsed: () => void;
  isFullscreenRoom: boolean;
}

const VibezNavContext = createContext<VibezNavContextValue | null>(null);

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem(COLLAPSE_KEY);
  if (stored === "1") return true;
  if (stored === "0") return false;
  // Default collapsed on phone-class viewports so the main event stays centered.
  return window.innerWidth < 768;
}

export function VibezNavProvider({
  children,
  isFullscreenRoom = false,
}: {
  children: React.ReactNode;
  isFullscreenRoom?: boolean;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const planet = useMemo(() => detectPlanet(pathname), [pathname]);
  const subjects = useMemo(() => subjectsForPlanet(planet), [planet]);
  const activity = useMemo(() => activityFeedForPlanet(planet), [planet]);
  const [subjectId, setSubjectIdState] = useState(() =>
    defaultSubjectId(detectPlanet(pathname), pathname)
  );
  const [collapsed, setCollapsedState] = useState(readCollapsed);

  useEffect(() => {
    setSubjectIdState(defaultSubjectId(planet, pathname));
  }, [planet, pathname]);

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  const setSubjectId = useCallback((id: string) => {
    setSubjectIdState(id);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("vibez:subject", { detail: { id, pathname } })
      );
    }
  }, [pathname]);

  const selectSubject = useCallback(
    (subject: VibezSubject) => {
      setSubjectId(subject.id);
      if (subject.href) {
        navigate(subject.href);
      }
    },
    [navigate, setSubjectId]
  );

  const value = useMemo<VibezNavContextValue>(
    () => ({
      planet,
      planetTitle: planetLabel(planet),
      subjects,
      planetLinks: PLANET_LINKS,
      activity,
      subjectId,
      setSubjectId,
      selectSubject,
      collapsed,
      setCollapsed,
      toggleCollapsed,
      isFullscreenRoom,
    }),
    [
      planet,
      subjects,
      activity,
      subjectId,
      setSubjectId,
      selectSubject,
      collapsed,
      setCollapsed,
      toggleCollapsed,
      isFullscreenRoom,
    ]
  );

  return (
    <VibezNavContext.Provider value={value}>{children}</VibezNavContext.Provider>
  );
}

export function useVibezNav(): VibezNavContextValue {
  const ctx = useContext(VibezNavContext);
  if (!ctx) {
    throw new Error("useVibezNav must be used within VibezNavProvider");
  }
  return ctx;
}

/**
 * Optional hook — returns null outside provider (for pages that may render
 * without shell during tests). Prefer useVibezNav in shell-backed routes.
 */
export function useVibezNavOptional(): VibezNavContextValue | null {
  return useContext(VibezNavContext);
}

/**
 * Sync a local filter state with the sidebar subject id.
 * When `ids` is provided, only sync when subject is in that allow-list.
 */
export function useVibezSubject(
  fallback: string,
  ids?: string[]
): [string, (id: string) => void] {
  const ctx = useVibezNavOptional();
  const [local, setLocal] = useState(fallback);

  useEffect(() => {
    if (!ctx) return;
    if (ids && !ids.includes(ctx.subjectId)) return;
    setLocal(ctx.subjectId);
  }, [ctx, ctx?.subjectId, ids]);

  const setBoth = useCallback(
    (id: string) => {
      setLocal(id);
      ctx?.setSubjectId(id);
    },
    [ctx]
  );

  if (!ctx) return [local, setLocal];
  if (ids && !ids.includes(ctx.subjectId)) return [local, setBoth];
  return [ctx.subjectId, setBoth];
}
