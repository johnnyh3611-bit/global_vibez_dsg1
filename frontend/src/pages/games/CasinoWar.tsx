/**
 * Casino War — single-card head-to-head · go to war on tie.
 */
import GenericCasinoGame from "./_GenericCasinoGame";

export default function CasinoWar() {
  return (
    <GenericCasinoGame
      testid="casino-war-page"
      title="Casino War"
      tagline="One card vs dealer · go to war on tie or surrender for half-stake"
      themeBg="from-black via-red-950/15 to-black"
      themeButton="from-red-500 to-rose-500"
      iconText="⚔️"
      endpoint="/api/games/casino-war/play"
      bets={[
        {
          label: "On Tie",
          testid: "cw-go-to-war",
          options: [{ label: "Surrender (-half)", value: "false" }, { label: "Go to War", value: "true" }],
          defaultValue: "false",
        },
      ]}
      buildBody={(v) => ({ go_to_war: v["On Tie"] === "true" })}
      renderResult={(r: any) => (
        <div className="space-y-2">
          <div className="text-sm">Outcome: <b className="font-mono text-cyan-300">{r.outcome.replace(/_/g, " ").toUpperCase()}</b></div>
          <div className="text-xs">
            Player: <b>{r.player_card.rank}{r.player_card.suit}</b> · Dealer: <b>{r.dealer_card.rank}{r.dealer_card.suit}</b>
          </div>
          {r.war && <div className="text-xs text-yellow-300">⚔️ WAR — Player {r.war.war_player_card.rank}{r.war.war_player_card.suit} vs Dealer {r.war.war_dealer_card.rank}{r.war.war_dealer_card.suit}</div>}
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
