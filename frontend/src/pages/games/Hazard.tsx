/**
 * Hazard — 17th-century English dice (precursor to Craps).
 */
import GenericCasinoGame from "./_GenericCasinoGame";
import { PremiumDice } from "@/components/games/vibedice654/PremiumDice";

export default function Hazard() {
  return (
    <GenericCasinoGame
      testid="hazard-page"
      title="Hazard"
      tagline="Pick a 'main' 5..9 · roll 2 dice · classic English dice game"
      themeBg="from-black via-purple-950/15 to-black"
      themeButton="from-purple-500 to-fuchsia-500"
      iconText="🎲"
      endpoint="/api/games/hazard/play"
      bets={[
        {
          label: "Main",
          testid: "hazard-main",
          options: [5, 6, 7, 8, 9].map(n => ({ label: `${n}`, value: n })),
          defaultValue: 7,
        },
      ]}
      buildBody={(v) => ({ main: v["Main"] })}
      renderResult={(r: any) => {
        const lastRoll: number[] = r.history?.[r.history.length - 1] ?? [1, 1];
        return (
          <div className="space-y-3">
            <div className="flex justify-center gap-3">
              {lastRoll.map((d: number, i: number) => (
                <PremiumDice key={i} value={d} rolling={false} isQualifier={r.gross > 0} />
              ))}
            </div>
            <div className="text-sm text-center">Outcome: <b className="font-mono text-cyan-300">{r.outcome.replace(/_/g, " ").toUpperCase()}</b></div>
            <div className="text-xs text-center text-neutral-400">Rolls: <span className="font-mono">{r.history.map((d: number[]) => `[${d.join(",")}]`).join(" → ")}</span></div>
            <div className="grid grid-cols-3 gap-2 text-sm font-mono pt-2 border-t border-white/10">
              <div><div className="text-[10px] text-neutral-500">GROSS</div><b className={r.gross >= 0 ? "text-emerald-300" : "text-rose-300"}>${r.gross.toFixed(2)}</b></div>
              <div><div className="text-[10px] text-neutral-500">TAX</div><b className="text-yellow-300">${r.tax.toFixed(2)}</b></div>
              <div><div className="text-[10px] text-neutral-500">NET</div><b className={r.net >= 0 ? "text-emerald-300" : "text-rose-300"}>${r.net.toFixed(2)}</b></div>
            </div>
          </div>
        );
      }}
    />
  );
}
