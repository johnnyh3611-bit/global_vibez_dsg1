/**
 * Expand `:vibez_fire:`-style shortcodes using the messaging emoji manifest.
 * Falls back to unicode_fallback when no image asset is available.
 */

const SHORTCODE_RE = /:([a-z0-9_]+):/gi;

export function expandEmojiShortcodes(text, manifestByCode = {}) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(SHORTCODE_RE, (match, code) => {
    const key = String(code).toLowerCase();
    const entry = manifestByCode[key];
    if (!entry) return match;
    return entry.unicode_fallback || entry.emoji || match;
  });
}

export function indexEmojiManifest(emojis = []) {
  const byCode = {};
  for (const item of emojis) {
    if (item?.code) byCode[item.code] = item;
  }
  return byCode;
}
