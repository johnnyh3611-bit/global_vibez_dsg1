/**
 * DomTranslator — bulletproof DOM-walking translator that replaces
 * the Google Translate widget (which keeps failing in production).
 *
 * Founder bug 2026-02-19: "I changed it to five different languages
 * and it stayed on English the whole time."
 *
 * How it works
 * ------------
 * 1. Walks the DOM looking for visible English text nodes
 * 2. Batches up to 80 unique strings at a time
 * 3. POSTs to `/api/i18n/translate` (server uses Emergent LLM
 *    + L1/L2 cache so repeat strings are instant)
 * 4. Swaps the original text with the translation in-place
 * 5. Persists to localStorage so subsequent page navs are instant
 * 6. Re-runs on every route change via a MutationObserver so newly-
 *    mounted React components get translated automatically
 *
 * Tracks `data-i18n-orig` on each touched node so toggling back to
 * English restores the originals exactly.
 *
 * Wired in App.js — listens for `gv:locale-changed` events and runs.
 */
const STORAGE_PREFIX = 'gv_i18n_v1';
const BATCH_SIZE = 80;
const MIN_TEXT_LEN = 2;

// Static cache of translated strings keyed by `${target}::${text}`.
// Hydrated from localStorage on first call.
let _hydratedTargets = new Set<string>();
const _memCache: Record<string, string> = {};

// Skip nodes that should NEVER be translated.
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA',
  'INPUT', 'IFRAME', 'CANVAS', 'svg', 'path',
]);
const SKIP_CLASSES = ['notranslate', 'gv-no-translate', 'font-mono'];

// Brand tokens that must stay verbatim.
const BRAND_PASSTHROUGH = [
  'Global Vibez', 'DSG', 'VibeRidez', 'Vibe TV', 'Vibe Eats',
  'JFTN', 'Vibez', 'Solana', 'Stripe', 'Phantom',
];

function _isBrandOnly(text: string): boolean {
  const trimmed = text.trim();
  return BRAND_PASSTHROUGH.some(
    (b) => trimmed === b || trimmed.toLowerCase() === b.toLowerCase(),
  );
}

function _shouldTranslate(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < MIN_TEXT_LEN) return false;
  // Skip pure numbers / punctuation / emoji-only
  if (/^[\d\s.,;:!?$%@#&*+\-=()\[\]{}|<>"'\/\\]+$/.test(t)) return false;
  // Skip strings that are mostly non-letters
  const letters = t.replace(/[^a-zA-Z]/g, '').length;
  if (letters < 2) return false;
  if (_isBrandOnly(t)) return false;
  return true;
}

function _hydrateFromStorage(target: string): void {
  if (_hydratedTargets.has(target)) return;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}_${target}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string>;
      Object.entries(parsed).forEach(([k, v]) => {
        _memCache[`${target}::${k}`] = v;
      });
    }
  } catch {
    /* localStorage disabled — fall through */
  }
  _hydratedTargets.add(target);
}

function _persistToStorage(target: string, mapping: Record<string, string>): void {
  try {
    const key = `${STORAGE_PREFIX}_${target}`;
    const raw = localStorage.getItem(key);
    const merged: Record<string, string> = raw ? JSON.parse(raw) : {};
    Object.assign(merged, mapping);
    localStorage.setItem(key, JSON.stringify(merged));
  } catch {
    /* quota exceeded — drop silently */
  }
}

function _collectTextNodes(): Array<{ node: Text; text: string }> {
  const out: Array<{ node: Text; text: string }> = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node: Node) {
        const parent = (node as Text).parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        // Skip if any ancestor opted out
        let walker: Element | null = parent;
        while (walker) {
          if (walker.classList && SKIP_CLASSES.some((c) => walker!.classList.contains(c))) {
            return NodeFilter.FILTER_REJECT;
          }
          if (walker.getAttribute && walker.getAttribute('translate') === 'no') {
            return NodeFilter.FILTER_REJECT;
          }
          walker = walker.parentElement;
        }
        const text = (node as Text).nodeValue || '';
        if (!_shouldTranslate(text)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const tn = n as Text;
    out.push({ node: tn, text: tn.nodeValue!.trim() });
  }
  return out;
}

async function _translateBatch(texts: string[], target: string): Promise<Record<string, string>> {
  const apiBase = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');
  try {
    const r = await fetch(`${apiBase}/api/i18n/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, texts }),
    });
    if (!r.ok) return {};
    const body = (await r.json()) as { translations: string[] };
    const map: Record<string, string> = {};
    texts.forEach((src, i) => {
      const tr = body.translations[i];
      if (tr && tr !== src) map[src] = tr;
    });
    return map;
  } catch {
    return {};
  }
}

let _running = false;
let _scheduled: number | null = null;

/**
 * Public API — translate the entire visible DOM into the target locale.
 * If target === 'en', restores all original-language nodes by reading
 * `data-i18n-orig` markers.
 */
export async function translatePage(target: string): Promise<void> {
  if (_running) return;
  if (typeof document === 'undefined') return;
  _running = true;
  try {
    if (target === 'en') {
      _restoreEnglish();
      return;
    }
    _hydrateFromStorage(target);

    const nodes = _collectTextNodes();
    if (!nodes.length) return;

    // Group nodes by trimmed text so we deduplicate translation work
    const grouped = new Map<string, Text[]>();
    for (const { node, text } of nodes) {
      const arr = grouped.get(text) ?? [];
      arr.push(node);
      grouped.set(text, arr);
    }

    // 1. Apply cached translations immediately for instant paint
    const uncached: string[] = [];
    for (const [src] of grouped) {
      const cached = _memCache[`${target}::${src}`];
      if (cached) {
        _applyTranslation(grouped.get(src)!, src, cached);
      } else {
        uncached.push(src);
      }
    }

    // 2. Fetch the rest in batches
    const persistMap: Record<string, string> = {};
    for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
      const slice = uncached.slice(i, i + BATCH_SIZE);
      const map = await _translateBatch(slice, target);
      for (const [src, tr] of Object.entries(map)) {
        _memCache[`${target}::${src}`] = tr;
        persistMap[src] = tr;
        _applyTranslation(grouped.get(src)!, src, tr);
      }
    }
    if (Object.keys(persistMap).length) _persistToStorage(target, persistMap);
  } finally {
    _running = false;
  }
}

function _applyTranslation(nodes: Text[], original: string, translated: string): void {
  for (const node of nodes) {
    const parent = node.parentElement;
    if (parent && !parent.dataset.i18nOrig) {
      // Save the original ONCE so we can flip back to English later.
      parent.dataset.i18nOrig = original;
    }
    // Preserve leading/trailing whitespace exactly.
    const raw = node.nodeValue ?? '';
    const lead = raw.match(/^\s*/)?.[0] ?? '';
    const trail = raw.match(/\s*$/)?.[0] ?? '';
    node.nodeValue = lead + translated + trail;
  }
}

function _restoreEnglish(): void {
  // Walk the data-i18n-orig markers — that lets us restore exactly,
  // even if the tree has changed since translation.
  const els = document.querySelectorAll('[data-i18n-orig]');
  els.forEach((el) => {
    const orig = (el as HTMLElement).dataset.i18nOrig;
    if (!orig) return;
    // Find the first text-node child that we likely modified.
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE && child.nodeValue?.trim()) {
        const lead = child.nodeValue!.match(/^\s*/)?.[0] ?? '';
        const trail = child.nodeValue!.match(/\s*$/)?.[0] ?? '';
        child.nodeValue = lead + orig + trail;
        break;
      }
    }
    delete (el as HTMLElement).dataset.i18nOrig;
  });
}

/**
 * Idempotent installer — call once per app mount. Handles
 * (a) initial translation on load if a non-English locale is persisted
 * (b) future locale changes via the `gv:locale-changed` event
 * (c) re-translation of newly-mounted React subtrees via MutationObserver
 */
export function installDomTranslator(): void {
  if (typeof window === 'undefined') return;
  if ((window as any).__gvDomTranslatorInstalled) return;
  (window as any).__gvDomTranslatorInstalled = true;

  const getCurrentTarget = (): string => {
    try {
      const raw = localStorage.getItem('gv_localization_v2');
      if (!raw) return 'en';
      const parsed = JSON.parse(raw) as { languageCode?: string; localeCode?: string };
      return (parsed.languageCode || (parsed.localeCode || '').split('-')[0] || 'en').toLowerCase();
    } catch {
      return 'en';
    }
  };

  // Initial translation if user already picked a non-English language.
  const initialTarget = getCurrentTarget();
  if (initialTarget !== 'en') {
    setTimeout(() => translatePage(initialTarget), 600);
  }

  // Event-driven trigger.
  window.addEventListener('gv:locale-changed', (e: Event) => {
    const ce = e as CustomEvent<{ languageCode?: string; localeCode?: string }>;
    const lang = (
      ce.detail?.languageCode ||
      (ce.detail?.localeCode || '').split('-')[0] ||
      'en'
    ).toLowerCase();
    // small delay so the UI has time to update (e.g. modal close anim)
    setTimeout(() => translatePage(lang), 200);
  });

  // MutationObserver — re-translate when new content mounts.
  const obs = new MutationObserver(() => {
    if (_scheduled !== null) return;
    _scheduled = window.setTimeout(() => {
      _scheduled = null;
      const t = getCurrentTarget();
      if (t !== 'en') translatePage(t);
    }, 400);
  });
  obs.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: false,
  });
}

export default installDomTranslator;
