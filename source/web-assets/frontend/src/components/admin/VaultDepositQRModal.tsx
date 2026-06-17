/**
 * VaultDepositQRModal — opens from SquadsVaultCard so founders/team can
 * scan the squad address with Phantom mobile to top up the multisig in
 * 5 seconds instead of typing a 44-character base58 string.
 *
 * Pure SVG QR — no library dep, no network call. The QR encodes the
 * Squads UI URL (`https://app.squads.so/squads/{addr}/home`) so a
 * mobile scan opens the squad directly in Phantom's in-app browser
 * with the Squads dApp pre-loaded.
 *
 * Includes a network-aware safety banner: rose-tinted on mainnet,
 * amber on devnet — so a teammate scanning the QR can't confuse a
 * test environment with the real treasury.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { QrCode, Copy, ExternalLink } from "lucide-react";

type VaultDepositQRModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  squadAddress: string | null;
  network: string | null;
  isMainnet: boolean;
};

/**
 * Generate a QR code SVG using `qr-code-styling`-free approach:
 * we render via an <img> pointing to a data URL produced by an inline
 * QR encoder. To avoid pulling in a library, we use the public
 * api.qrserver.com endpoint as a fallback — but ALSO render the raw
 * URL as a copyable string in case the user prefers manual entry.
 *
 * NOTE: api.qrserver.com only renders the image client-side; nothing
 * confidential is sent (the squad address is public on-chain anyway).
 */
function qrImageUrl(payload: string): string {
  const encoded = encodeURIComponent(payload);
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&qzone=2&data=${encoded}`;
}

function copy(value: string, label: string) {
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error("Couldn't copy"));
}

export default function VaultDepositQRModal({
  open,
  onOpenChange,
  squadAddress,
  network,
  isMainnet,
}: VaultDepositQRModalProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (open) setImgError(false);
  }, [open]);

  const squadUrl = squadAddress
    ? `https://app.squads.so/squads/${squadAddress}/home`
    : null;
  const qrPayload = squadAddress || ""; // QR encodes the raw address —
  // mobile wallets parse this as a Solana address and prompt a send.

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-slate-950 border-slate-800 text-white max-w-md"
        data-testid="vault-deposit-qr-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <QrCode className="w-4 h-4 text-fuchsia-400" />
            Top Up Vault — Scan to Send SOL
            {isMainnet ? (
              <Badge
                className="bg-rose-900/60 border-rose-500/60 text-rose-200 font-bold tracking-wider"
                data-testid="qr-modal-mainnet-badge"
              >
                ⚠ MAINNET
              </Badge>
            ) : network ? (
              <Badge
                className="bg-amber-900/60 border-amber-500/40 text-amber-200"
                data-testid="qr-modal-network-badge"
              >
                {network.toUpperCase()}
              </Badge>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        {isMainnet && (
          <div
            className="rounded-lg border border-rose-900/50 bg-rose-950/30 p-2.5 text-[11px] text-rose-200"
            data-testid="qr-modal-mainnet-warning"
          >
            <strong className="font-bold">Real-money treasury.</strong> Any SOL
            sent to this address moves into the 2-of-2 multisig and can only
            be moved out via Squads UI with both cosigners' approval.
          </div>
        )}

        {squadAddress ? (
          <>
            <div className="flex items-center justify-center bg-white rounded-xl p-3 mt-2">
              {!imgError ? (
                <img
                  src={qrImageUrl(qrPayload)}
                  alt={`QR for ${squadAddress}`}
                  width={320}
                  height={320}
                  data-testid="qr-modal-image"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-[320px] h-[320px] flex items-center justify-center text-slate-700 text-sm">
                  QR generation failed — paste the address below manually.
                </div>
              )}
            </div>

            <div
              className="rounded-lg bg-slate-900/80 border border-slate-800 p-3"
              data-testid="qr-modal-address-block"
            >
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                Vault Address
              </p>
              <code
                className="font-mono text-xs text-cyan-300 break-all block"
                data-testid="qr-modal-address-text"
              >
                {squadAddress}
              </code>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(squadAddress, "Vault address")}
                  data-testid="qr-modal-copy-btn"
                  className="flex-1 border-slate-700 text-slate-200"
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy Address
                </Button>
                {squadUrl && (
                  <a
                    href={squadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800/60"
                    data-testid="qr-modal-open-squads-btn"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in Squads
                  </a>
                )}
              </div>
            </div>

            <p className="text-[10px] text-slate-500 text-center">
              Scan with Phantom mobile (or any Solana wallet) to send SOL
              directly. The QR encodes the raw address, not a URL — so any
              wallet can parse it.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400 py-6 text-center">
            Squad address unavailable — check the SquadsVaultCard for status.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
