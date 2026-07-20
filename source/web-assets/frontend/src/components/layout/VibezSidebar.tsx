/**
 * VibezSidebar — My Vibez design standard primary navigation.
 *
 * Persistent left rail: planet jump links, TikTok-style vertical subject
 * filter, and an activity engagement feed. Replaces horizontal / top-nav tabs.
 */
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useVibezNav } from "@/contexts/VibezNavContext";
import type { VibezSubject } from "@/components/layout/vibezSubjects";
import {
  vibezTabIconClass,
  vibezTabTriggerClass,
} from "@/components/ui/VibezTabStyle";

function SubjectButton({
  subject,
  active,
  collapsed,
  onSelect,
}: {
  subject: VibezSubject;
  active: boolean;
  collapsed: boolean;
  onSelect: () => void;
}) {
  const Icon = subject.icon;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={subject.testId || `vibez-subject-${subject.id}`}
      onClick={onSelect}
      title={subject.label}
      className={cn(
        vibezTabTriggerClass({ active, variant: "sidebar" }),
        "shrink-0 snap-start",
        collapsed && "justify-center px-2"
      )}
    >
      {Icon ? <Icon className={vibezTabIconClass(active)} /> : null}
      {!collapsed && <span className="truncate">{subject.label}</span>}
    </button>
  );
}

export default function VibezSidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    planetTitle,
    subjects,
    planetLinks,
    activity,
    subjectId,
    selectSubject,
    collapsed,
    toggleCollapsed,
    isFullscreenRoom,
  } = useVibezNav();

  const isPlanetActive = (href?: string) => {
    if (!href) return false;
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      data-testid="vibez-sidebar"
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(
        "gv-vibez-sidebar sticky top-0 z-30 flex h-[100dvh] shrink-0 flex-col border-r border-white/10",
        "bg-[#0b0612]/92 backdrop-blur-xl",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-[4.25rem]" : "w-[15.5rem]",
        isFullscreenRoom && "bg-[#05070d]/95"
      )}
    >
      {/* Brand + collapse */}
      <div
        className={cn(
          "flex items-center gap-2 border-b border-white/10 px-3 py-3",
          collapsed && "justify-center px-2"
        )}
      >
        {!collapsed && (
          <button
            type="button"
            onClick={() => navigate("/my-vibez")}
            className="min-w-0 flex-1 text-left"
            data-testid="vibez-sidebar-brand"
          >
            <p className="truncate text-sm font-black tracking-tight text-transparent bg-gradient-to-r from-pink-400 via-fuchsia-400 to-violet-400 bg-clip-text">
              MY VIBEZ
            </p>
            <p className="truncate text-[10px] uppercase tracking-widest text-white/40">
              {planetTitle}
            </p>
          </button>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white transition"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          data-testid="vibez-sidebar-collapse"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Planet jump links */}
      <nav
        aria-label="Planet navigation"
        className="flex flex-col gap-1 border-b border-white/10 p-2"
        data-testid="vibez-planet-nav"
      >
        {planetLinks.map((link) => {
          const active = isPlanetActive(link.href);
          return (
            <SubjectButton
              key={link.id}
              subject={link}
              active={active}
              collapsed={collapsed}
              onSelect={() => selectSubject(link)}
            />
          );
        })}
      </nav>

      {/* TikTok-style vertical subject scroller */}
      <div className="flex min-h-0 flex-1 flex-col">
        {!collapsed && (
          <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/35">
            Subjects
          </p>
        )}
        <div
          role="tablist"
          aria-label="Subject filter"
          data-testid="vibez-subject-list"
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain p-2",
            "snap-y snap-mandatory scroll-smooth scrollbar-hide"
          )}
        >
          {subjects.map((subject) => (
            <SubjectButton
              key={subject.id}
              subject={subject}
              active={subjectId === subject.id || isPlanetActive(subject.href)}
              collapsed={collapsed}
              onSelect={() => selectSubject(subject)}
            />
          ))}
        </div>
      </div>

      {/* Activity engagement feed */}
      <div
        className="border-t border-white/10 p-2"
        data-testid="vibez-activity-feed"
      >
        {!collapsed && (
          <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-white/35">
            Activity
          </p>
        )}
        <div
          className={cn(
            "flex max-h-[28vh] flex-col gap-2 overflow-y-auto snap-y snap-mandatory scroll-smooth scrollbar-hide",
            collapsed && "max-h-none"
          )}
        >
          <AnimatePresence initial={false}>
            {activity.map((item, i) => (
              <motion.button
                key={item.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => item.href && navigate(item.href)}
                className={cn(
                  "snap-start rounded-xl border border-white/10 bg-white/5 p-2 text-left transition hover:bg-white/10",
                  collapsed && "flex items-center justify-center p-2"
                )}
                title={item.title}
                data-testid={`vibez-activity-${item.id}`}
              >
                {collapsed ? (
                  <span
                    className={cn(
                      "block h-2 w-2 rounded-full bg-gradient-to-r",
                      item.accent || "from-fuchsia-500 to-pink-500"
                    )}
                  />
                ) : (
                  <>
                    <p className="truncate text-xs font-bold text-white/90">
                      {item.title}
                    </p>
                    <p className="truncate text-[10px] text-white/45">
                      {item.meta}
                    </p>
                  </>
                )}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile expand hint when collapsed */}
      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex items-center justify-center border-t border-white/10 py-2 text-white/40 hover:text-white"
          aria-label="Expand navigation"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
      {!collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden items-center justify-center gap-1 border-t border-white/10 py-2 text-[10px] text-white/35 hover:text-white/70 sm:flex"
        >
          <ChevronLeft className="h-3 w-3" />
          Collapse
        </button>
      )}
    </aside>
  );
}
