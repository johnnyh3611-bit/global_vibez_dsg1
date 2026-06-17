/**
 * Chemin de Fer — banker variant of Baccarat.
 */
import GenericCasinoGame from "./_GenericCasinoGame";

export default function CheminDeFer() {
  return (
    <GenericCasinoGame
      testid="chemin-page"
      title="Chemin de Fer"
      tagline="Banker baccarat · 5% commission on banker wins · 8:1 tie"
      themeBg="from-black via-zinc-900 to-black"
      themeButton="from-yellow-500 to-amber-600"
      iconText="🎩"
      endpoint="/api/games/chemin-de-fer/play"
      bets={[
        {
          label: "Bet Side",
          testid: "chemin-side",
          options: [
            { label: "Player", value: "player" },
            { label: "Banker (-5%)", value: "banker" },
            { label: "Tie (8:1)", value: "tie" },
          ],
          defaultValue: "player",
        },
      ]}
      buildBody={(v) => ({ bet_side: v["Bet Side"] })}
      renderResult={(r: any) => (
        <div className="space-y-2">
          <div className="text-sm">Winner: <b className="font-mono text-cyan-300">{r.winner.toUpperCase()}</b> ({r.player_total} vs {r.banker_total})</div>
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
