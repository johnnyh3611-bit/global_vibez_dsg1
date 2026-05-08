/**
 * Fan-Tan — Chinese bean game · pick 1-4 · 3:1 payout (-5% house cut).
 */
import GenericCasinoGame from "./_GenericCasinoGame";

export default function FanTan() {
  return (
    <GenericCasinoGame
      testid="fan-tan-page"
      title="Fan-Tan"
      tagline="Chinese bean game · pick 1-4 · pile divided by 4 leaves your number"
      themeBg="from-black via-red-950/15 to-black"
      themeButton="from-red-500 to-rose-500"
      iconText="🪙"
      endpoint="/api/games/fan-tan/play"
      bets={[
        {
          label: "Pick",
          testid: "fantan-pick",
          options: [1, 2, 3, 4].map(n => ({ label: `${n}`, value: n })),
          defaultValue: 1,
        },
      ]}
      buildBody={(v) => ({ pick: v["Pick"] })}
      renderResult={(r: any) => (
        <div className="space-y-2">
          <div className="text-sm">Pile: <b className="font-mono text-cyan-300">{r.pile}</b> · Remainder: <b className="font-mono text-yellow-300 text-xl">{r.remainder}</b></div>
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
