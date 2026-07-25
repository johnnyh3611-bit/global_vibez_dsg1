/**
 * VibezShell — app chrome for protected routes: top hub strip + main content.
 * The persistent left VibezSidebar was removed (took too much space / unreadable
 * in demo mode); category filters live on each page again.
 */
import React from "react";
import { cn } from "@/lib/utils";
import HubSwitcher from "@/components/hubs/HubSwitcher";
import GlobalNavbar from "@/components/GlobalNavbar";
import PageActionStrip from "@/components/common/PageActionStrip";

export interface VibezShellProps {
  children: React.ReactNode;
  /** Fullscreen game / cinema rooms — hide top strip. */
  isFullscreenRoom?: boolean;
  className?: string;
}

export default function VibezShell({
  children,
  isFullscreenRoom = false,
  className,
}: VibezShellProps) {
  return (
    <div
      className={cn(
        "gv-vibez-shell flex min-h-[100dvh] w-full bg-transparent",
        className
      )}
      data-testid="vibez-shell"
      data-fullscreen={isFullscreenRoom ? "true" : "false"}
    >
      <div className="gv-vibez-main flex min-w-0 flex-1 flex-col">
        {!isFullscreenRoom && (
          <div
            className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 pt-3 sm:flex-row sm:items-center sm:justify-between"
            data-testid="protected-route-action-strip"
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <HubSwitcher />
              <GlobalNavbar />
            </div>
            <PageActionStrip align="end" />
          </div>
        )}
        <div
          className={cn(
            "gv-route-root flex-1",
            isFullscreenRoom && "min-h-0 overflow-hidden"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
