/**
 * GeniusQRKit — personal QR + invite link card for chair holders.
 *
 * Pulls the share payload (which auto-mints an invite code) and renders
 * a QR encoding the join URL plus copy-to-clipboard + Twitter intent.
 *
 * The "Genius Kit" name reflects Phase 1 first-believer branding —
 * Genius buyers ($10, 3×) are the founder cohort. Phase 2 is now
 * called "Genesis" and inherits expansion-wave branding instead.
 */
import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Twitter, Sparkles } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

type Payload = {
  chairs: number;
  rank: string;
  invite_code: string;
  join_url: string;
  og_image_url: string;
  share_text_short: string;
  share_text_long: string;
  twitter_intent: string;
};

export default function GeniusQRKit() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch(`${API}/api/chairs/share/payload`, { method: "POST" })
      .then(async r => {
        if (r.ok) setPayload(await r.json());
        else {
          const e = await r.json().catch(() => ({}));
          setError(e?.detail || "Park a chair to unlock your Genius Kit.");
        }
      })
      .catch(() => setError("Could not load Genius Kit."));
  }, []);

  const copyLink = async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload.join_url);
      toast.success(`Invite link ${payload.invite_code} copied.`);
    } catch {
      toast.success(`Invite ${payload.invite_code} ready.`);
    }
  };

  if (error) {
    return (
      <div
        data-testid="genius-qr-locked"
        className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 text-center"
      >
        <Sparkles className="w-6 h-6 mx-auto text-amber-300" />
        <p className="mt-2 text-sm font-bold text-white">Genius Kit locked</p>
        <p className="mt-1 text-[12px] text-slate-400">{error}</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 text-center">
        <p className="text-slate-400 text-xs">Loading your Genius Kit…</p>
      </div>
    );
  }

  return (
    <div
      data-testid="genius-qr-kit"
      className="rounded-2xl border border-cyan-500/40 bg-slate-900/70 p-6 text-center"
    >
      <p className="text-[10px] uppercase tracking-widest text-cyan-300 font-bold">
        Your Genius Kit · {payload.rank}
      </p>
      <h3 className="text-xl font-black text-white mt-1">
        Post this. Get paid.
      </h3>

      <div className="mt-4 inline-block bg-white p-3 rounded-xl">
        <QRCodeCanvas
          value={payload.join_url}
          size={196}
          level="H"
          includeMargin={false}
          data-testid="genius-qr-canvas"
        />
      </div>

      <p className="mt-3 text-[11px] text-slate-300 font-mono break-all">
        {payload.join_url}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-amber-300">
        Invite code · {payload.invite_code}
      </p>

      <div className="mt-4 flex gap-2 justify-center flex-wrap">
        <button
          onClick={copyLink}
          data-testid="genius-qr-copy"
          className="flex items-center gap-1 rounded-full bg-cyan-500 text-black px-4 py-2 text-[11px] font-black uppercase tracking-widest hover:brightness-110"
        >
          <Copy className="w-3 h-3" /> Copy link
        </button>
        <a
          href={payload.twitter_intent}
          target="_blank"
          rel="noreferrer"
          data-testid="genius-qr-twitter"
          className="flex items-center gap-1 rounded-full bg-sky-500 text-black px-4 py-2 text-[11px] font-black uppercase tracking-widest hover:brightness-110"
        >
          <Twitter className="w-3 h-3" /> Post on X
        </a>
      </div>

      <p className="mt-4 text-[10px] text-slate-500 leading-relaxed">
        Earn +10 loyalty stakes every time someone scans your code and parks
        their first chair. Discretionary loyalty bonus, not investment yield.
      </p>
    </div>
  );
}
