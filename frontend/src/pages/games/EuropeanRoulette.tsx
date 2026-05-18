/**
 * European Roulette — single-zero wheel · all standard outside bets.
 */
import GenericCasinoGame from "./_GenericCasinoGame";

export default function EuropeanRoulette() {
  return (
    <GenericCasinoGame
      testid="eu-roulette-page"
      title="European Roulette"
      tagline="Single-zero wheel · 35:1 straight, 2:1 column, 1:1 outside"
      themeBg="from-black via-emerald-950/20 to-black"
      themeButton="from-emerald-500 to-teal-500"
      iconText="🇪🇺"
      endpoint="/api/games/european-roulette/play"
      bets={[
        {
          label: "Bet Type",
          testid: "eu-bet-type",
          options: [
            { label: "Red (1:1)", value: "red" },
            { label: "Black (1:1)", value: "black" },
            { label: "Even (1:1)", value: "even" },
            { label: "Odd (1:1)", value: "odd" },
            { label: "Low 1-18 (1:1)", value: "low" },
            { label: "High 19-36 (1:1)", value: "high" },
            { label: "Dozen 1 (2:1)", value: "dozen-1" },
            { label: "Dozen 2 (2:1)", value: "dozen-2" },
            { label: "Dozen 3 (2:1)", value: "dozen-3" },
            { label: "Column 1 (2:1)", value: "column-1" },
            { label: "Column 2 (2:1)", value: "column-2" },
            { label: "Column 3 (2:1)", value: "column-3" },
            { label: "Straight 17 (35:1)", value: "straight-17" },
            { label: "Straight 7 (35:1)", value: "straight-7" },
            { label: "Straight 0 (35:1)", value: "straight-0" },
          ],
          defaultValue: "red",
        },
      ]}
      buildBody={(v) => {
        const raw = v["Bet Type"] as string;
        if (raw.startsWith("dozen-")) return { bet_type: "dozen", bet_value: parseInt(raw.split("-")[1], 10) };
        if (raw.startsWith("column-")) return { bet_type: "column", bet_value: parseInt(raw.split("-")[1], 10) };
        if (raw.startsWith("straight-")) return { bet_type: "straight", bet_value: parseInt(raw.split("-")[1], 10) };
        return { bet_type: raw, bet_value: null };
      }}
      renderResult={(r: any) => (
        <div className="space-y-2">
          <div className="text-sm">Landed: <b className="font-mono text-cyan-300 text-xl">#{r.landed}</b></div>
          <div className="text-xs">{r.won ? "WIN" : "LOSS"} · payout {r.payout_ratio}:1</div>
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
