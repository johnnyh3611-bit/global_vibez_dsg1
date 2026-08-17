/**
 * Chuck-A-Luck — 3 dice, pick a number 1-6, triple = 10:1.
 */
import GenericCasinoGame from "./_GenericCasinoGame";
import { PremiumDice } from "@/components/games/vibedice654/PremiumDice";

export default function ChuckALuck() {
  return (
    <GenericCasinoGame
      testid="chuck-page"
      title="Chuck-A-Luck"
      tagline="3 dice rolled · 1 match=1:1 · 2 match=2:1 · triple=10:1"
      themeBg="from-black via-cyan-950/10 to-black"
      themeButton="from-cyan-500 to-sky-500"
      iconText="🎲"
      endpoint="/api/games/chuck-a-luck/play"
      bets={[
        {
          label: "Pick",
          testid: "chuck-pick",
          options: [1, 2, 3, 4, 5, 6].map(n => ({ label: `${n}`, value: n })),
          defaultValue: 3,
        },
      ]}
      buildBody={(v) => ({ picked_number: v["Pick"] })}
      renderResult={(r: any) => (
        <div className="space-y-3">
          <div className="flex justify-center gap-3">
            {r.dice.map((d: number, i: number) => (
              <PremiumDice key={i} value={d} rolling={false} isQualifier={d === r.picked} />
            ))}
          </div>
          <div className="text-xs text-center text-neutral-400">Matches: <b className="text-cyan-300">{r.matches}</b> · Payout {r.payout_ratio}:1</div>
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
