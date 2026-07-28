/**
 * useDealBidSequence — shared deal animation → hand review → bid modal flow.
 *
 * Used by SpadesAAA and BidWhistAAA. Previous implementations put side
 * effects (clearInterval / setBidModalOpen) inside a setState updater,
 * which React 18 may double-invoke or discard — leaving the player stuck
 * on "Waiting for bids…" with no modal. Timers are cancelled on restart
 * so overlapping deal sequences cannot fight each other.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface DealBidSequenceOptions {
  /** Deal fly-in duration before the hand becomes visible (ms). */
  dealMs?: number;
  /** Hand-review countdown before the bid modal auto-opens (seconds). */
  reviewSeconds?: number;
}

export interface DealBidSequence {
  dealing: boolean;
  bidModalOpen: boolean;
  reviewActive: boolean;
  reviewRemaining: number;
  setBidModalOpen: (open: boolean) => void;
  setDealing: (dealing: boolean) => void;
  setReviewActive: (active: boolean) => void;
  startDealSequence: () => void;
  endReviewAndShowBid: () => void;
  /** Cancel timers and reset local animation flags (e.g. back-to-lobby). */
  resetSequence: () => void;
}

export function useDealBidSequence(
  options: DealBidSequenceOptions = {},
): DealBidSequence {
  const dealMs = options.dealMs ?? 3500;
  const reviewSeconds = options.reviewSeconds ?? 10;

  const [dealing, setDealing] = useState(false);
  const [bidModalOpen, setBidModalOpen] = useState(false);
  const [reviewActive, setReviewActive] = useState(false);
  const [reviewRemaining, setReviewRemaining] = useState(reviewSeconds);

  const dealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingRef = useRef(reviewSeconds);
  const generationRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (dealTimeoutRef.current) {
      clearTimeout(dealTimeoutRef.current);
      dealTimeoutRef.current = null;
    }
    if (reviewIntervalRef.current) {
      clearInterval(reviewIntervalRef.current);
      reviewIntervalRef.current = null;
    }
  }, []);

  const endReviewAndShowBid = useCallback(() => {
    clearTimers();
    remainingRef.current = 0;
    setReviewActive(false);
    setReviewRemaining(0);
    setBidModalOpen(true);
  }, [clearTimers]);

  const startDealSequence = useCallback(() => {
    clearTimers();
    const gen = ++generationRef.current;

    setDealing(true);
    setBidModalOpen(false);
    setReviewActive(false);
    remainingRef.current = reviewSeconds;
    setReviewRemaining(reviewSeconds);

    dealTimeoutRef.current = setTimeout(() => {
      if (generationRef.current !== gen) return;
      setDealing(false);
      setReviewActive(true);
      remainingRef.current = reviewSeconds;
      setReviewRemaining(reviewSeconds);

      reviewIntervalRef.current = setInterval(() => {
        if (generationRef.current !== gen) {
          clearTimers();
          return;
        }
        remainingRef.current -= 1;
        const next = Math.max(0, remainingRef.current);
        setReviewRemaining(next);
        if (next <= 0) {
          clearTimers();
          setReviewActive(false);
          setBidModalOpen(true);
        }
      }, 1000);
    }, dealMs);
  }, [clearTimers, dealMs, reviewSeconds]);

  const resetSequence = useCallback(() => {
    generationRef.current += 1;
    clearTimers();
    remainingRef.current = reviewSeconds;
    setDealing(false);
    setBidModalOpen(false);
    setReviewActive(false);
    setReviewRemaining(reviewSeconds);
  }, [clearTimers, reviewSeconds]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return {
    dealing,
    bidModalOpen,
    reviewActive,
    reviewRemaining,
    setBidModalOpen,
    setDealing,
    setReviewActive,
    startDealSequence,
    endReviewAndShowBid,
    resetSequence,
  };
}
