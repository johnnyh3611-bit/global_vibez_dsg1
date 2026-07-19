/**
 * Beta Payment Environment notice — shown on wallet / top-up surfaces.
 * Links users to support when a credit doesn't appear.
 */
import React from "react";
import { AlertTriangle, LifeBuoy } from "lucide-react";

export interface BetaPaymentInfo {
  beta_mode?: boolean;
  label?: string;
  support_email?: string;
  support_discord?: string;
  note?: string;
}

interface Props {
  info?: BetaPaymentInfo | null;
  /** Force-show even if beta_mode is false (e.g. Helio test network). */
  force?: boolean;
  className?: string;
}

export default function BetaPaymentBanner({
  info,
  force = false,
  className = "",
}: Props) {
  const show = force || Boolean(info?.beta_mode);
  if (!show) return null;

  const email = info?.support_email || "payments-beta@globalvibezdsg.com";
  const discord = info?.support_discord || "https://discord.gg/globalvibez";
  const label = info?.label || "Beta Payment Environment";
  const note =
    info?.note ||
    "Card rails are limited to Founding Members while we verify live credits.";

  return (
    <div
      className={`rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2.5 text-left ${className}`}
      data-testid="beta-payment-banner"
      role="status"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider text-amber-200">
            {label}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-amber-100/80">
            {note}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-cyan-200/90">
            <span className="inline-flex items-center gap-1">
              <LifeBuoy className="h-3 w-3" />
              Support:{" "}
              <a
                href={`mailto:${email}`}
                className="underline underline-offset-2 hover:text-white"
              >
                {email}
              </a>
            </span>
            <a
              href={discord}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-white"
            >
              Discord
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
