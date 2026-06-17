/**
 * Pill-shaped wrapper around `@solana/wallet-adapter-react-ui`'s
 * WalletMultiButton, restyled to match the app's neon aesthetic.
 *
 * Renders nothing visually if Solana wallet support is disabled via env
 * (REACT_APP_SOLANA_DISABLE=1) so the rest of the UI stays clean.
 */
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const DISABLED = process.env.REACT_APP_SOLANA_DISABLE === "1";

export default function WalletConnectButton({
  className = "",
}: {
  className?: string;
}) {
  if (DISABLED) return null;
  return (
    <div className={className} data-testid="solana-wallet-connect">
      <WalletMultiButton
        style={{
          background:
            "linear-gradient(90deg, rgba(168,85,247,0.95), rgba(34,211,238,0.95))",
          color: "#000",
          fontWeight: 700,
          borderRadius: 9999,
          height: 36,
          fontSize: 12,
          padding: "0 18px",
        }}
      />
    </div>
  );
}
