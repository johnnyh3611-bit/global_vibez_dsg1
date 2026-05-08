/**
 * Pai Gow — 7-card high vs banker. 5% commission on win.
 */
import GenericCasinoGame from "./_GenericCasinoGame";

export default function PaiGow() {
  return (
    <GenericCasinoGame
      testid="pai-gow-page"
      title="Pai Gow"
      tagline="7-card high roll · 5% commission on win · Push on tie"
      themeBg="from-black via-amber-950/10 to-black"
      themeButton="from-amber-500 to-orange-500"
      iconText="🀄"
      endpoint="/api/games/pai-gow/play"
      bets={[]}
      buildBody={() => ({})}
      renderResult={(r: any) => (
        <div className="space-y-3">
          <div className="text-sm">Outcome: <b className="font-mono text-cyan-300">{r.outcome.toUpperCase()}</b></div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Player high: <b className="text-emerald-300">{r.player_high}</b></div>
            <div>Banker high: <b className="text-rose-300">{r.dealer_high}</b></div>
          </div>
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
