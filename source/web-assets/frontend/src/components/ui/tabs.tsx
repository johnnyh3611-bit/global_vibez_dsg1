/**
 * @deprecated My Vibez design standard — horizontal Radix tabs are decommissioned.
 * Use VibezSidebar / useVibezSubject for navigation and subject filtering.
 * This file remains only as a thin compatibility shim for any stray imports.
 */
import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

if (typeof console !== "undefined" && process.env.NODE_ENV !== "production") {
  // Soft deprecation signal for developers — do not throw.
  console.warn(
    "[DEPRECATED] @/components/ui/tabs — use VibezSidebar / useVibezSubject instead of horizontal tabs."
  );
}

/** @deprecated Prefer VibezSidebar subjects. */
const Tabs = TabsPrimitive.Root

/** @deprecated Prefer VibezSidebar subjects. */
const TabsList = React.forwardRef<any, any>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex h-auto w-full flex-col items-stretch justify-start gap-1 rounded-2xl backdrop-blur-xl bg-white/5 p-1 text-white/60 border border-white/10",
      className
    )}
    {...props} />
))
TabsList.displayName = TabsPrimitive.List.displayName

/** @deprecated Prefer VibezSidebar subjects. */
const TabsTrigger = React.forwardRef<any, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex w-full items-center justify-start gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-xs sm:text-sm font-bold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-fuchsia-600 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(232,121,249,0.6)] hover:text-white hover:bg-white/5",
      className
    )}
    {...props} />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

/** @deprecated Prefer VibezSidebar subjects. */
const TabsContent = React.forwardRef<any, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60 focus-visible:ring-offset-2",
      className
    )}
    {...props} />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
