import { getChairHolders } from "@/lib/dealer/chairs";

export interface ChairLedgerEntry {
  seatNumber: number;
  wallet: string;
  dsgInCirculation: number;
  status: "active";
}

export interface ChairLedgerSnapshot {
  generatedAt: string;
  tokenPerChair: number;
  circulatingSupply: number;
  entries: ChairLedgerEntry[];
}

function tokenPerChair(): number {
  const parsed = Number(process.env.DSG_TOKEN_PER_CHAIR ?? "1000");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1000;
}

export function getChairLedgerSnapshot(): ChairLedgerSnapshot {
  const holders = Array.from(getChairHolders()).sort((a, b) => a.localeCompare(b));
  const perChair = tokenPerChair();

  const entries = holders.map((wallet, index) => ({
    seatNumber: index + 1,
    wallet,
    dsgInCirculation: perChair,
    status: "active" as const,
  }));

  return {
    generatedAt: new Date().toISOString(),
    tokenPerChair: perChair,
    circulatingSupply: entries.length * perChair,
    entries,
  };
}
