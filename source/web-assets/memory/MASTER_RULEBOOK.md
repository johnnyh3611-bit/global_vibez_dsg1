# Global Vibez DSG — Master Rulebook

**This file is the canonical source of truth for every design + code
decision in the Global Vibez DSG platform.** The `knowledge_lock` audit
agent reads it on every run and rejects code that violates these rules.

When you change a rule here, the audit gate enforces it automatically
on the next `bash scripts/run_quality_gates.sh` run.

---

## 1. Technical Stack (non-negotiable)

- **Frontend:** React 19 (CRA + craco alias `@` → `src/`), Tailwind CSS, Framer Motion.
- **Backend:** FastAPI + Motor (async MongoDB), APScheduler, Socket.IO.
- **Auth:** Emergent-managed Google + `httpOnly` JWT cookies.
- **Payments:** Stripe; chair purchases flow through `record_revenue()` → 40-30-30 split.
- **Blockchain:** Solana Devnet (→ Mainnet on safeword "domains"). On-chain token ticker: **$DSG** (the Solana SPL token). Company brand: **Global Vibez DSG™**. In-app currency (off-chain): **Vibez Coins / ₵ / Vibe Credits** — converts 1:1 to $DSG at TGE.
- **Treasury:** Squads 2-of-2 multi-sig + Streamflow payroll streams + Jupiter USDC swap.

## 2. Design Laws — "Cyber-Casino" Aesthetic

### Theme
Futuristic Underground Club meets Celestial Glasshouse. Dark & neon. NO pastel.

### Color tokens (hex → Tailwind class)
| Role | Hex | Tailwind |
|---|---|---|
| Base background | `#000000` – `#050507` | `bg-black` or `bg-[#050507]` |
| Primary neon | `#22d3ee` (cyan-400) | `text-cyan-400` / `border-cyan-500/40` |
| Secondary accent | `#a855f7` (purple-500) | `text-purple-400` / `bg-purple-600` |
| Success / win | `#22c55e` (emerald-500) | `text-emerald-400` |
| Warning / loss | `#ef4444` (red-500) | `text-red-400` |

All card-suit + animation hex values MUST import from
`@/lib/cardGameColors` — not re-declared inline.

### Hard UI rules (enforced by `knowledge_lock.py`)

1. **NEVER** use `overflow-scroll` on containers. Use `overflow-y-auto scrollbar-hide` instead (scrollbar-hide is provided by `tailwindcss-scrollbar-hide` plugin).
2. **Status bars** MUST be `fixed bottom-0 left-0 w-full z-50` + `backdrop-blur-md` or `backdrop-blur-xl`.
3. **Primary menu bars** MUST use `flex flex-wrap` (so nav items wrap on narrow screens like Chromebooks) + `gap-*` for spacing.
4. **3D card tables** MUST have `perspective-1000` on their container.
5. **Betting controls** MUST be sliders (`<input type="range">`) — never raw text inputs. Currency labels display `₵` (Vibez Coins), not `$`.
6. **Every interactive button** MUST have `data-testid`.
7. **Timers** in React components MUST use `useSafeTimeout` from `@/hooks/useSafeTimeout`, not raw `setTimeout`.
8. **Framer-motion spring physics** for card dealing MUST use `stiffness: 80, damping: 15` by default.

## 3. Game Mechanics Foundation

- Multi-player card games are **4 players max** unless the game explicitly requires more (Uno is 4-10, Poker is 2-9).
- Card-dealing animation default: `{ type: "spring", stiffness: 80, damping: 15 }`.
- **Big Wheel Spades ruleset** uses a 54-card deck (52 + 2 jokers). Classic uses 52.
- Game phase state machine MUST cover at minimum: `idle → dealing → bidding → playing → scoring → ended`.
- No game may allow a wager of floating-point Vibez Coins — always integer.

## 4. Treasury + Chairs Rules (LEGAL)

- Chair/Vault system is a **utility/loyalty pass**. NEVER use the words "dividend", "security", "stock", "investment return", or "yield".
- The founder's draw is capped at **$20,000 / month** once monthly revenue ≥ **$1,000,000**.
- Overflow from the cap flows into the **Chair Holder Rewards Pool** (a sub-bucket of the Reserve).
- The public `/treasury` page is READ-ONLY for chair holders.

## 5. Self-Improvement Loop

- Every time a human user files a design lesson via the `<LogDesignLesson />` button, it's persisted to MongoDB (`design_lessons` collection) and appended to `/app/memory/LEARNING_LOG.md`.
- `LEARNING_LOG.md` is cumulative — never edit past entries, only append.
- When the audit gate runs in CI, it re-reads this rulebook — any rule you add here becomes enforced on the next run.
