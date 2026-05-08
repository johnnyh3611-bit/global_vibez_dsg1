/**
 * VoiceMirrorContext — global, app-wide Voice Mirror integration.
 *
 * Any chat / conversation surface in the app can call `useVoiceMirrorTarget`
 * to register itself as the "active conversation" for the floating voice
 * dock. When the user records a voice note, the dock transcribes + translates
 * (via /api/voice-mirror/transcribe-and-translate) and then calls the
 * registered callback with the translated text so the chat can inject it
 * into its message stream.
 *
 * This lets one user speak in their native language and the translated
 * version lands in the other person's chat — unlocking "Voice Mirror
 * everywhere people have a conversation" without each surface having
 * to reimplement the Whisper/translate/TTS pipeline.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type VoiceMirrorLang = {
  code: string;
  label: string;
  flag: string;
};

export const VOICE_MIRROR_LANGUAGES: VoiceMirrorLang[] = [
  { code: "EN", label: "English", flag: "🇬🇧" },
  { code: "ES", label: "Spanish", flag: "🇪🇸" },
  { code: "FR", label: "French", flag: "🇫🇷" },
  { code: "DE", label: "German", flag: "🇩🇪" },
  { code: "IT", label: "Italian", flag: "🇮🇹" },
  { code: "PT", label: "Portuguese", flag: "🇵🇹" },
  { code: "JA", label: "Japanese", flag: "🇯🇵" },
  { code: "KO", label: "Korean", flag: "🇰🇷" },
  { code: "ZH", label: "Chinese", flag: "🇨🇳" },
  { code: "AR", label: "Arabic", flag: "🇸🇦" },
  { code: "HI", label: "Hindi", flag: "🇮🇳" },
  { code: "RU", label: "Russian", flag: "🇷🇺" },
];

export type VoiceMirrorResult = {
  original: string;
  translated: string;
  sourceLang: string;
  targetLang: string;
  audioBase64?: string;
};

export type VoiceMirrorTargetHandler = (result: VoiceMirrorResult) => void;

export type VoiceMirrorTarget = {
  id: string;
  label: string; // e.g. "Global Lobby Chat" — shown in the dock
  onTranslated: VoiceMirrorTargetHandler;
};

type VoiceMirrorContextValue = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  targetLang: string;
  setTargetLang: (code: string) => void;
  autoTranslateIncoming: boolean;
  setAutoTranslateIncoming: (v: boolean) => void;
  registerTarget: (target: VoiceMirrorTarget) => () => void;
  activeTarget: VoiceMirrorTarget | null;
  lastResult: VoiceMirrorResult | null;
  pushResult: (result: VoiceMirrorResult) => void;
};

const VoiceMirrorContext = createContext<VoiceMirrorContextValue | null>(null);

const STORAGE_ENABLED = "voice_mirror_enabled";
const STORAGE_LANG = "voice_mirror_target_lang";
const STORAGE_AUTOTR = "voice_mirror_autotranslate_incoming";

export const VoiceMirrorProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_ENABLED) === "1";
  });
  const [targetLang, setTargetLangState] = useState<string>(() => {
    if (typeof window === "undefined") return "EN";
    return localStorage.getItem(STORAGE_LANG) || "EN";
  });
  const [autoTranslateIncoming, setAutoTrState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_AUTOTR) === "1";
  });
  const [lastResult, setLastResult] = useState<VoiceMirrorResult | null>(null);

  // Stack of registered targets — the last-mounted active chat is the one
  // that receives translated voice notes.
  const targetsRef = useRef<VoiceMirrorTarget[]>([]);
  const [activeTarget, setActiveTarget] = useState<VoiceMirrorTarget | null>(
    null
  );

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    try {
      localStorage.setItem(STORAGE_ENABLED, v ? "1" : "0");
    } catch { /* ignore */ }
  }, []);

  const setTargetLang = useCallback((code: string) => {
    setTargetLangState(code);
    try {
      localStorage.setItem(STORAGE_LANG, code);
    } catch { /* ignore */ }
  }, []);

  const setAutoTranslateIncoming = useCallback((v: boolean) => {
    setAutoTrState(v);
    try {
      localStorage.setItem(STORAGE_AUTOTR, v ? "1" : "0");
    } catch { /* ignore */ }
  }, []);

  const recomputeActive = useCallback(() => {
    const list = targetsRef.current;
    setActiveTarget(list.length > 0 ? list[list.length - 1] : null);
  }, []);

  const registerTarget = useCallback(
    (target: VoiceMirrorTarget) => {
      targetsRef.current = [
        ...targetsRef.current.filter((t) => t.id !== target.id),
        target,
      ];
      recomputeActive();
      return () => {
        targetsRef.current = targetsRef.current.filter(
          (t) => t.id !== target.id
        );
        recomputeActive();
      };
    },
    [recomputeActive]
  );

  const pushResult = useCallback((result: VoiceMirrorResult) => {
    setLastResult(result);
    const list = targetsRef.current;
    const active = list.length > 0 ? list[list.length - 1] : null;
    if (active) {
      try {
        active.onTranslated(result);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[VoiceMirror] target handler threw", e);
      }
    }
  }, []);

  const value = useMemo<VoiceMirrorContextValue>(
    () => ({
      enabled,
      setEnabled,
      targetLang,
      setTargetLang,
      autoTranslateIncoming,
      setAutoTranslateIncoming,
      registerTarget,
      activeTarget,
      lastResult,
      pushResult,
    }),
    [
      enabled,
      setEnabled,
      targetLang,
      setTargetLang,
      autoTranslateIncoming,
      setAutoTranslateIncoming,
      registerTarget,
      activeTarget,
      lastResult,
      pushResult,
    ]
  );

  return (
    <VoiceMirrorContext.Provider value={value}>
      {children}
    </VoiceMirrorContext.Provider>
  );
};

export function useVoiceMirror(): VoiceMirrorContextValue {
  const ctx = useContext(VoiceMirrorContext);
  if (!ctx) {
    throw new Error(
      "useVoiceMirror must be used inside <VoiceMirrorProvider>"
    );
  }
  return ctx;
}

/**
 * Register a chat/conversation surface as the active Voice Mirror target.
 * When the global dock produces a translated transcript, it calls
 * `onTranslated(result)` so the caller can inject the text into its
 * outgoing message stream.
 *
 * Safe to call unconditionally — the hook no-ops if the provider isn't
 * mounted (shouldn't happen in the app, but keeps storybook/tests clean).
 */
export function useVoiceMirrorTarget(
  target: { id: string; label: string; onTranslated: VoiceMirrorTargetHandler } | null
) {
  const ctx = useContext(VoiceMirrorContext);
  const handlerRef = useRef<VoiceMirrorTargetHandler | null>(null);
  handlerRef.current = target?.onTranslated || null;

  useEffect(() => {
    if (!ctx || !target) return;
    const unregister = ctx.registerTarget({
      id: target.id,
      label: target.label,
      onTranslated: (result) => {
        if (handlerRef.current) handlerRef.current(result);
      },
    });
    return unregister;
  }, [ctx, target?.id, target?.label]);
}
