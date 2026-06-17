/**
 * useAutoTranslate — fetch a translated version of arbitrary text when the
 * user has enabled "auto-translate incoming" in the Voice Mirror dock.
 *
 * Caches results across components by `text|targetLang` so the same chat
 * message isn't re-translated when multiple subscribers render it.
 *
 * Pair with <TranslatedSubtitle text={msg.text} /> to get an inline,
 * in-place, grey-italic line under every foreign-language message.
 */
import { useEffect, useRef, useState } from "react";
import { useVoiceMirror } from "@/contexts/VoiceMirrorContext";

const API = process.env.REACT_APP_BACKEND_URL;

type CacheEntry =
  | { kind: "pending"; promise: Promise<TranslateResult> }
  | { kind: "done"; value: TranslateResult };

type TranslateResult = {
  original: string;
  translated: string;
  targetLang: string;
  sameLanguage: boolean;
};

const cache = new Map<string, CacheEntry>();
const MAX_CACHE = 500;

const keyFor = (text: string, lang: string) =>
  `${lang}\u0001${text.trim().toLowerCase()}`;

async function fetchTranslation(
  text: string,
  targetLang: string,
  sourceHint?: string
): Promise<TranslateResult> {
  const res = await fetch(`${API}/api/chat/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      text,
      target_lang: targetLang,
      source_hint: sourceHint || null,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body.slice(0, 200));
  }
  const data = await res.json();
  return {
    original: data.original || text,
    translated: data.translated || "",
    targetLang: data.target_lang || targetLang,
    sameLanguage: Boolean(data.same_language),
  };
}

export type UseAutoTranslateState = {
  enabled: boolean;
  targetLang: string;
  translated: string | null;
  sameLanguage: boolean;
  loading: boolean;
  error: string | null;
};

export function useAutoTranslate(
  text: string | undefined | null,
  options?: { sourceHint?: string; minLength?: number }
): UseAutoTranslateState {
  const { autoTranslateIncoming, targetLang } = useVoiceMirror();
  const [state, setState] = useState<UseAutoTranslateState>({
    enabled: autoTranslateIncoming,
    targetLang,
    translated: null,
    sameLanguage: false,
    loading: false,
    error: null,
  });

  const abortRef = useRef(false);
  const minLen = options?.minLength ?? 2;

  useEffect(() => {
    abortRef.current = false;
    const raw = (text || "").trim();
    if (!autoTranslateIncoming || !raw || raw.length < minLen) {
      setState({
        enabled: autoTranslateIncoming,
        targetLang,
        translated: null,
        sameLanguage: false,
        loading: false,
        error: null,
      });
      return;
    }

    const k = keyFor(raw, targetLang);
    const hit = cache.get(k);

    if (hit && hit.kind === "done") {
      setState({
        enabled: true,
        targetLang,
        translated: hit.value.translated,
        sameLanguage: hit.value.sameLanguage,
        loading: false,
        error: null,
      });
      return;
    }

    setState({
      enabled: true,
      targetLang,
      translated: null,
      sameLanguage: false,
      loading: true,
      error: null,
    });

    let promise: Promise<TranslateResult>;
    if (hit && hit.kind === "pending") {
      promise = hit.promise;
    } else {
      promise = fetchTranslation(raw, targetLang, options?.sourceHint);
      cache.set(k, { kind: "pending", promise });
      // Trim oldest entries when cache grows too large.
      if (cache.size > MAX_CACHE) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) cache.delete(firstKey);
      }
    }

    promise
      .then((value) => {
        cache.set(k, { kind: "done", value });
        if (abortRef.current) return;
        setState({
          enabled: true,
          targetLang,
          translated: value.translated,
          sameLanguage: value.sameLanguage,
          loading: false,
          error: null,
        });
      })
      .catch((e: Error) => {
        cache.delete(k);
        if (abortRef.current) return;
        setState({
          enabled: true,
          targetLang,
          translated: null,
          sameLanguage: false,
          loading: false,
          error: e.message,
        });
      });

    return () => {
      abortRef.current = true;
    };
  }, [text, autoTranslateIncoming, targetLang, options?.sourceHint, minLen]);

  return state;
}
