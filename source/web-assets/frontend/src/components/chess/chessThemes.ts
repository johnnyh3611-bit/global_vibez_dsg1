/** Premium material themes for Global Vibez chess. */

export type ChessThemeId = "midnight" | "heirloom" | "cyber";

export type ChessTheme = {
  id: ChessThemeId;
  label: string;
  tagline: string;
  /** Light square */
  light: string;
  /** Dark square */
  dark: string;
  boardFrame: string;
  boardGlow: string;
  boardTexture: string;
  whitePiece: { fill: string; stroke: string; gloss: string; shadow: string };
  blackPiece: { fill: string; stroke: string; gloss: string; shadow: string };
  legalHalo: string;
  lastMove: string;
  checkAura: string;
  captureTrail: string;
  railBg: string;
  accent: string;
};

export const CHESS_THEMES: Record<ChessThemeId, ChessTheme> = {
  midnight: {
    id: "midnight",
    label: "Midnight Executive",
    tagline: "Obsidian · brushed platinum",
    light: "#2a3038",
    dark: "#12151a",
    boardFrame:
      "linear-gradient(145deg,#1a1d24 0%,#0b0d10 50%,#22262e 100%)",
    boardGlow: "0 0 40px rgba(120,160,255,0.18), 0 24px 60px rgba(0,0,0,0.65)",
    boardTexture:
      "radial-gradient(circle at 30% 20%, rgba(180,200,255,0.08), transparent 45%)",
    whitePiece: {
      fill: "#d7dde8",
      stroke: "#8a93a3",
      gloss: "rgba(255,255,255,0.55)",
      shadow: "rgba(0,0,0,0.55)",
    },
    blackPiece: {
      fill: "#1a1c22",
      stroke: "#6e7688",
      gloss: "rgba(200,210,255,0.25)",
      shadow: "rgba(0,0,0,0.7)",
    },
    legalHalo: "rgba(140,180,255,0.45)",
    lastMove: "rgba(120,160,255,0.28)",
    checkAura: "rgba(255,80,60,0.55)",
    captureTrail: "rgba(180,200,255,0.5)",
    railBg: "rgba(10,12,16,0.85)",
    accent: "#9eb6ff",
  },
  heirloom: {
    id: "heirloom",
    label: "Classic Heirloom",
    tagline: "Walnut · weighted ivory",
    light: "#e8d5b5",
    dark: "#7a4e2d",
    boardFrame:
      "linear-gradient(145deg,#5c3a22 0%,#3a2214 40%,#6b4428 100%)",
    boardGlow: "0 18px 50px rgba(0,0,0,0.55)",
    boardTexture:
      "repeating-linear-gradient(90deg, rgba(0,0,0,0.03) 0 2px, transparent 2px 6px)",
    whitePiece: {
      fill: "#f4efe6",
      stroke: "#c4b49a",
      gloss: "rgba(255,255,255,0.65)",
      shadow: "rgba(40,20,10,0.45)",
    },
    blackPiece: {
      fill: "#3a2414",
      stroke: "#1a1008",
      gloss: "rgba(255,220,160,0.2)",
      shadow: "rgba(0,0,0,0.55)",
    },
    legalHalo: "rgba(212,175,55,0.4)",
    lastMove: "rgba(212,175,55,0.32)",
    checkAura: "rgba(200,60,40,0.5)",
    captureTrail: "rgba(180,120,60,0.45)",
    railBg: "rgba(28,18,12,0.9)",
    accent: "#d4af37",
  },
  cyber: {
    id: "cyber",
    label: "Cyber Vibe",
    tagline: "Matte black · electric cyan",
    light: "#1c2430",
    dark: "#0a0e14",
    boardFrame:
      "linear-gradient(145deg,#0e141c 0%,#05070a 50%,#12202e 100%)",
    boardGlow: "0 0 48px rgba(0,255,220,0.2), 0 0 20px rgba(255,200,50,0.12)",
    boardTexture:
      "linear-gradient(rgba(0,255,220,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,220,0.04) 1px, transparent 1px)",
    whitePiece: {
      fill: "#0d1118",
      stroke: "#00f0c8",
      gloss: "rgba(0,255,220,0.35)",
      shadow: "rgba(0,255,220,0.25)",
    },
    blackPiece: {
      fill: "#0a0c10",
      stroke: "#f0c14a",
      gloss: "rgba(255,200,80,0.3)",
      shadow: "rgba(255,180,40,0.2)",
    },
    legalHalo: "rgba(0,255,220,0.4)",
    lastMove: "rgba(0,255,220,0.22)",
    checkAura: "rgba(255,60,100,0.55)",
    captureTrail: "rgba(0,255,220,0.5)",
    railBg: "rgba(6,10,14,0.92)",
    accent: "#00f0c8",
  },
};

export const THEME_ORDER: ChessThemeId[] = ["midnight", "heirloom", "cyber"];

export function loadChessTheme(): ChessThemeId {
  try {
    const t = localStorage.getItem("gv_chess_theme") as ChessThemeId | null;
    if (t && CHESS_THEMES[t]) return t;
  } catch {
    /* ignore */
  }
  return "heirloom";
}

export function saveChessTheme(id: ChessThemeId) {
  try {
    localStorage.setItem("gv_chess_theme", id);
  } catch {
    /* ignore */
  }
}
