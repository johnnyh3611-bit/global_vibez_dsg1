/**
 * Faro — vintage saloon card game · soda/hock card calls.
 */
import GenericCasinoGame from "./_GenericCasinoGame";

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

export default function Faro() {
  return (
    <GenericCasinoGame
      testid="faro-page"
      title="Faro"
      tagline="19th-century saloon classic · pick a rank · soda loses, hock wins"
      themeBg="from-black via-stone-900 to-black"
      themeButton="from-stone-500 to-amber-700"
      iconText="🎴"
      endpoint="/api/games/faro/play"
      bets={[
        {
          label: "Pick Rank",
          testid: "faro-rank",
          options: RANKS.map(r => ({ label: r, value: r })),
          defaultValue: "K",
        },
      ]}
      buildBody={(v) => ({ picked_rank: v["Pick Rank"] })}
      renderResult={(r: any) => (
        <div className="space-y-2">
          <div className="text-sm">Outcome: <b className="font-mono text-cyan-300">{r.outcome.toUpperCase()}</b></div>
          <div className="text-xs">Soda (lose): <b>{r.losing_card.rank}{r.losing_card.suit}</b> · Hock (win): <b>{r.winning_card.rank}{r.winning_card.suit}</b></div>
          <div className="grid grid-cols-3 gap-2 text-sm font-mono pt-2 border-t border-white/10">
            <div><div className="text-[10px] text-neutral-500">GROSS</div><b className={r.gross >= 0 ? "text-emerald-300" : "text-rose-300"}>₵{r.gross.toFixed(2)}</b></div>
            <div><div className="text-[10px] text-neutral-500">TAX</div><b className="text-yellow-300">₵{r.tax.toFixed(2)}</b></div>
            <div><div className="text-[10px] text-neutral-500">NET</div><b className={r.net >= 0 ? "text-emerald-300" : "text-rose-300"}>₵{r.net.toFixed(2)}</b></div>
          </div>
        </div>
      )}
    />
  );
}
