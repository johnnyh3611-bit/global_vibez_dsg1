/**
 * Big Six Wheel — 54-segment money wheel.
 */
import GenericCasinoGame from "./_GenericCasinoGame";

export default function BigSixWheel() {
  return (
    <GenericCasinoGame
      testid="big-six-page"
      title="Big Six Wheel"
      tagline="54 segments · $1, $2, $5, $10, $20, Joker, Logo (40:1)"
      themeBg="from-black via-yellow-950/15 to-black"
      themeButton="from-yellow-400 to-amber-500"
      iconText="🎡"
      endpoint="/api/games/big-six-wheel/play"
      bets={[
        {
          label: "Bet Label",
          testid: "big6-bet",
          options: [
            { label: "$1 (1:1)", value: "$1" },
            { label: "$2 (2:1)", value: "$2" },
            { label: "$5 (5:1)", value: "$5" },
            { label: "$10 (10:1)", value: "$10" },
            { label: "$20 (20:1)", value: "$20" },
            { label: "Joker (40:1)", value: "Joker" },
            { label: "Logo (40:1)", value: "Logo" },
          ],
          defaultValue: "$1",
        },
      ]}
      buildBody={(v) => ({ bet_label: v["Bet Label"] })}
      renderResult={(r: any) => (
        <div className="space-y-2">
          <div className="text-sm">Landed: <b className="font-mono text-cyan-300 text-xl">{r.landed}</b></div>
          <div className="text-xs">{r.won ? `WINNER ${r.payout_ratio}:1` : "Better luck next spin"}</div>
          <div className="grid grid-cols-3 gap-2 text-sm font-mono pt-2 border-t border-white/10">
            <div><div className="text-[10px] text-neutral-500">GROSS</div><b className={r.gross >= 0 ? "text-emerald-300" : "text-rose-300"}>${r.gross.toFixed(2)}</b></div>
            <div><div className="text-[10px] text-neutral-500">TAX</div><b className="text-yellow-300">${r.tax.toFixed(2)}</b></div>
            <div><div className="text-[10px] text-neutral-500">NET</div><b className={r.net >= 0 ? "text-emerald-300" : "text-rose-300"}>${r.net.toFixed(2)}</b></div>
          </div>
        </div>
      )}
    />
  );
}
