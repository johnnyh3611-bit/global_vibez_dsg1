/**
 * Shared active Vibe Phone / FaceTime call — so game tables can host
 * <VibeCallRoom> inside GameVideoLayout's PiP dock instead of fighting
 * the global bottom-right overlay.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type ActiveVibeCall = {
  callId: string;
  channel: string;
  mediaType: "voice" | "video";
  peerLabel?: string;
};

type Ctx = {
  call: ActiveVibeCall | null;
  /** How many game layouts are currently mounting the call in their dock */
  gameDockConsumers: number;
  setCall: (call: ActiveVibeCall | null) => void;
  clearCall: () => void;
  registerGameDock: () => () => void;
};

const ActiveVibeCallContext = createContext<Ctx | null>(null);

export function ActiveVibeCallProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [call, setCallState] = useState<ActiveVibeCall | null>(null);
  const [gameDockConsumers, setConsumers] = useState(0);

  const setCall = useCallback((next: ActiveVibeCall | null) => {
    setCallState(next);
  }, []);

  const clearCall = useCallback(() => setCallState(null), []);

  const registerGameDock = useCallback(() => {
    setConsumers((n) => n + 1);
    return () => setConsumers((n) => Math.max(0, n - 1));
  }, []);

  const value = useMemo(
    () => ({
      call,
      gameDockConsumers,
      setCall,
      clearCall,
      registerGameDock,
    }),
    [call, gameDockConsumers, setCall, clearCall, registerGameDock],
  );

  return (
    <ActiveVibeCallContext.Provider value={value}>
      {children}
    </ActiveVibeCallContext.Provider>
  );
}

export function useActiveVibeCall(): Ctx {
  const ctx = useContext(ActiveVibeCallContext);
  if (!ctx) {
    // Safe no-op outside provider (tests / storybook)
    return {
      call: null,
      gameDockConsumers: 0,
      setCall: () => {},
      clearCall: () => {},
      registerGameDock: () => () => {},
    };
  }
  return ctx;
}
