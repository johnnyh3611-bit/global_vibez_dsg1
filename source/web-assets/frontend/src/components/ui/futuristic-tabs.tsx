/**
 * FuturisticTabs — thin alias of VibezTabStyle (My Vibez design system).
 *
 * Prefer importing VibezTabStyle directly for new code.
 */
import React from "react";
import VibezTabStyle, {
  type VibezTabOption,
  type VibezTabStyleProps,
} from "@/components/ui/VibezTabStyle";

export type FuturisticTabOption = VibezTabOption;

export type FuturisticTabsProps = Omit<VibezTabStyleProps, "testId"> & {
  /** @deprecated Use VibezTabStyle testId */
  testId?: string;
};

export function FuturisticTabs({
  testId = "futuristic-tabs",
  ...props
}: FuturisticTabsProps) {
  return <VibezTabStyle {...props} testId={testId} />;
}

export default FuturisticTabs;
