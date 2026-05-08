/**
 * LedgerConnectButton — pill-shaped trigger for connecting a Ledger
 * hardware wallet via WebHID. Deliberately separate from the standard
 * Solana wallet-adapter button because Ledger uses a different signing
 * pipeline (device-signer-kit, not wallet-adapter).
 *
 * Status badges:
 *   • idle        → "Connect Ledger"
 *   • connecting  → "Connecting…" (disabled)
 *   • connected   → shortened pubkey (click to disconnect)
 *   • error       → "Retry · <reason>"
 */
import { useLedger } from "./LedgerSignerProvider";

const DISABLED = process.env.REACT_APP_SOLANA_DISABLE === "1";

function shortKey(b58: string): string {
  return `${b58.slice(0, 4)}…${b58.slice(-4)}`;
}

export default function LedgerConnectButton({
  className = "",
}: {
  className?: string;
}) {
  if (DISABLED) return null;
  const { status, publicKey, error, connect, disconnect } = useLedger();

  const onClick = async () => {
    try {
      if (status === "connected") {
        await disconnect();
      } else {
        await connect();
      }
    } catch {
      /* surfaced via context.error */
    }
  };

  const label = (() => {
    switch (status) {
      case "connecting":
        return "Connecting Ledger…";
      case "connected":
        return publicKey ? `Ledger · ${shortKey(publicKey.toBase58())}` : "Connected";
      case "error":
        return `Retry · ${(error || "error").slice(0, 24)}`;
      default:
        return "Connect Ledger";
    }
  })();

  return (
    <div className={className} data-testid="ledger-connect-wrapper">
      <button
        type="button"
        onClick={onClick}
        disabled={status === "connecting"}
        data-testid="ledger-connect-button"
        title={status === "error" && error ? error : undefined}
        style={{
          background:
            status === "connected"
              ? "linear-gradient(90deg, rgba(34,211,238,0.95), rgba(74,222,128,0.95))"
              : "linear-gradient(90deg, rgba(15,23,42,0.95), rgba(30,41,59,0.95))",
          color: status === "connected" ? "#000" : "#e2e8f0",
          fontWeight: 700,
          borderRadius: 9999,
          height: 36,
          fontSize: 12,
          padding: "0 18px",
          border: "1px solid rgba(34,211,238,0.4)",
          cursor: status === "connecting" ? "wait" : "pointer",
          opacity: status === "connecting" ? 0.6 : 1,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </button>
    </div>
  );
}
