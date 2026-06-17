/**
 * TableStylePicker — 5-thumbnail picker for per-user card-table cosmetic
 * preference. Lives in profile/settings or any cosmetics shop page.
 *
 * Each thumbnail is a tiny preview rendered with the same CSS classes that
 * the actual game tables use (so the user is selecting the real thing).
 */
import { Check } from "lucide-react";
import { useTableStyle, TABLE_STYLES } from "@/hooks/useTableStyle";

export default function TableStylePicker() {
  const { style, setStyle } = useTableStyle();

  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-5"
      data-testid="table-style-picker"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-cyan-300">
            Table Style
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">
            Pick the cosmetic background for your card-game tables. Applies
            to Spades, Bid Whist, Blackjack, and Poker.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-amber-300">
          Free · cosmetic only
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {TABLE_STYLES.map((opt) => {
          const active = style === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStyle(opt.id)}
              data-testid={`table-style-${opt.id}`}
              className={`relative aspect-[5/4] rounded-xl overflow-hidden border-2 transition ${
                active
                  ? "border-cyan-300 shadow-[0_0_22px_rgba(34,211,238,0.45)]"
                  : "border-white/10 hover:border-white/30"
              }`}
            >
              {/* Thumbnail uses the actual table-style CSS class so the
                  preview matches the in-game look exactly. */}
              <div
                className={`absolute inset-0 table-style-${opt.id}`}
                aria-hidden
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 py-1">
                <p className="text-[11px] font-black text-white">
                  {opt.label}
                </p>
                <p className="text-[9px] text-white/65 leading-tight">
                  {opt.hint}
                </p>
              </div>
              {active && (
                <span className="absolute top-2 right-2 bg-cyan-300 text-black rounded-full p-1">
                  <Check className="w-3 h-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
