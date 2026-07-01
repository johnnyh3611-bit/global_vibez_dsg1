/**
 * Vibe Venues — Booking Detail page.
 *
 *   • Shows the full booking (venue, artisan, pricing breakdown)
 *   • Renders the lifecycle timeline (pending → escrowed → … → paid_out)
 *   • Wires the on-chain escrow lock: when the customer is in 'pending'
 *     state, they connect Solflare and sign an SPL-token transfer of the
 *     grand_total (in devnet USDC for now — swap mint at TGE) into the
 *     platform escrow treasury. The tx signature is then POSTed to
 *     `/bookings/{id}/escrow-lock`.
 *   • Vibe-Check button lets the customer rate after the event.
 */
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  Home,
  ChefHat,
  Clock,
  CheckCircle2,
  Lock,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import VibeSyncChat from "@/components/vibe-venues/VibeSyncChat";
import { DishSizzleOverlay } from "@/components/restaurant/RestaurantPaymentVideo";

const API = process.env.REACT_APP_BACKEND_URL!;
const RPC = process.env.REACT_APP_VIBEZ_RPC || "https://api.devnet.solana.com";

// Platform receive wallet (escrow custodian). Until $DSG token launches we
// settle in devnet USDC on the same mint the payout daemon already uses.
const ESCROW_TREASURY = new PublicKey(
  process.env.REACT_APP_VIBE_VENUES_TREASURY ||
    "8fn1G5eUxvUxz1KfQ7yxFkJkB5o91Cej76xq2Tx58mph",
);
const ESCROW_TOKEN_MINT = new PublicKey(
  process.env.REACT_APP_VIBE_VENUES_TOKEN_MINT ||
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // devnet USDC
);
const TOKEN_DECIMALS = 6;

type Booking = {
  booking_id: string;
  customer_user_id: string;
  venue_name: string;
  artisan_name?: string | null;
  start_at: string;
  block_hours: number;
  pricing: {
    house_rental_total_usd: number;
    platform_fee_usd: number;
    host_payout_usd: number;
    artisan_service_total_usd: number;
    artisan_prep_fee_usd: number;
    artisan_balance_usd: number;
    grand_total_usd: number;
  };
  lifecycle_state: string;
  lifecycle_history: Array<{ state: string; at: string }>;
  review?: { rating: number; text: string; at: string } | null;
  vibe_check_passed_at?: string | null;
  escrow_tx_signature?: string;
};

const LIFECYCLE_STEPS = [
  { state: "pending", label: "Booking Created", icon: Clock },
  { state: "escrowed", label: "Escrow Locked", icon: Lock },
  { state: "prep_released", label: "Prep-Fee Released to Chef", icon: ChefHat },
  { state: "paid_out", label: "Vibe-Check Passed → Balance Released", icon: CheckCircle2 },
];

export default function VibeVenuesBookingDetail() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { publicKey, signTransaction, connected } = useWallet();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [showSizzle, setShowSizzle] = useState(false);
  const [sizzleVideoUrl, setSizzleVideoUrl] = useState<string>("");

  const refresh = async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/vibe-venues/bookings/${bookingId}`);
      if (r.ok) setBooking(await r.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const lockEscrow = async () => {
    if (!booking) return;
    if (!connected || !publicKey || !signTransaction) {
      toast.error("Connect Solflare first");
      return;
    }
    setBusy(true);
    try {
      const conn = new Connection(RPC, "confirmed");
      const amountBaseUnits = BigInt(
        Math.round(booking.pricing.grand_total_usd * 10 ** TOKEN_DECIMALS),
      );

      // Resolve sender + receiver Associated Token Accounts
      const senderAta = await getAssociatedTokenAddress(ESCROW_TOKEN_MINT, publicKey);
      const receiverAta = await getAssociatedTokenAddress(ESCROW_TOKEN_MINT, ESCROW_TREASURY);

      const tx = new Transaction();

      // Auto-create the treasury ATA if missing — the booking customer pays
      // the rent. (One-time per token; subsequent bookings skip this.)
      try {
        await getAccount(conn, receiverAta);
      } catch {
        tx.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            receiverAta,
            ESCROW_TREASURY,
            ESCROW_TOKEN_MINT,
          ),
        );
      }

      tx.add(
        createTransferCheckedInstruction(
          senderAta,
          ESCROW_TOKEN_MINT,
          receiverAta,
          publicKey,
          amountBaseUnits,
          TOKEN_DECIMALS,
          [],
          TOKEN_PROGRAM_ID,
        ),
      );

      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
      tx.feePayer = publicKey;
      tx.recentBlockhash = blockhash;

      const signed = await signTransaction(tx);
      const sig = await conn.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

      // Tell backend
      const r = await fetch(
        `${API}/api/vibe-venues/bookings/${booking.booking_id}/escrow-lock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tx_signature: sig }),
        },
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "escrow-lock failed");
      toast.success(`Escrow locked · sig ${sig.slice(0, 12)}…`);
      setBooking(data.booking);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const releasePrep = async () => {
    if (!booking) return;
    setBusy(true);
    try {
      const r = await fetch(
        `${API}/api/vibe-venues/bookings/${booking.booking_id}/release-prep`,
        { method: "POST" },
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "release-prep failed");
      setBooking(data.booking);
      toast.success("Prep-fee released to chef");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitVibeCheck = async () => {
    if (!booking) return;
    setBusy(true);
    try {
      const r = await fetch(
        `${API}/api/vibe-venues/bookings/${booking.booking_id}/vibe-check`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating, review_text: reviewText }),
        },
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Vibe-Check failed");
      setBooking(data.booking);
      // Trigger Dish Sizzle Clip celebratory overlay on payment success.
      // If the artisan attached a Signature Commercial we use that; else the
      // overlay still renders the stats reveal with a black backdrop.
      try {
        const aRes = await fetch(
          `${API}/api/vibe-venues/artisans?limit=200`,
        ).then((r) => r.json());
        const a = (aRes.artisans || []).find(
          (x: any) => x.artisan_id === data.booking.artisan_id,
        );
        if (a?.commercial_video_url) {
          setSizzleVideoUrl(
            a.commercial_video_url.startsWith("/")
              ? `${API}${a.commercial_video_url}`
              : a.commercial_video_url,
          );
        }
      } catch {}
      setShowSizzle(true);
      toast.success("Vibe-Check submitted — balance released");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const dispute = async () => {
    if (!booking) return;
    const reason = prompt("Why are you opening this dispute?");
    if (!reason) return;
    setBusy(true);
    try {
      const r = await fetch(
        `${API}/api/vibe-venues/bookings/${booking.booking_id}/dispute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Dispute failed");
      setBooking(data.booking);
      toast("Dispute opened — Founders & Crew will mediate");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-[#07030F] text-white flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
      </div>
    );

  if (!booking)
    return (
      <div className="min-h-screen bg-[#07030F] text-white p-10 text-center">
        Booking not found.
      </div>
    );

  const p = booking.pricing;
  const reachedIdx = LIFECYCLE_STEPS.findIndex((s) => s.state === booking.lifecycle_state);
  const isCustomer = booking.customer_user_id === (localStorage.getItem("user_id") || "guest");

  return (
    <div className="min-h-screen bg-[#07030F] text-white pb-24" data-testid="vv-booking-detail-page">
      {showSizzle && sizzleVideoUrl && (
        <DishSizzleOverlay
          videoUrl={sizzleVideoUrl}
          stats={{
            price_per_plate_usd: p.artisan_service_total_usd
              ? Math.round(p.artisan_service_total_usd / Math.max(1, booking.block_hours))
              : undefined,
            wait_minutes: 0,
            servings: booking.block_hours * 2,
          }}
          onClose={() => setShowSizzle(false)}
        />
      )}
      <div className="max-w-4xl mx-auto px-4 py-10">
        <button
          onClick={() => navigate("/vibe-venues")}
          className="flex items-center gap-2 text-purple-300/70 hover:text-white mb-6"
          data-testid="vv-bk-back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> All venues
        </button>

        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-400/80">
              Booking · {booking.booking_id}
            </p>
            <h1 className="text-3xl md:text-4xl font-black mt-1">{booking.venue_name}</h1>
            <div className="flex items-center gap-2 text-sm text-purple-300/80 mt-2">
              <Clock className="w-4 h-4" />
              {new Date(booking.start_at).toLocaleString()} · {booking.block_hours} hr block
              {booking.artisan_name && (
                <>
                  <span className="mx-2">·</span>
                  <ChefHat className="w-4 h-4 text-orange-300" />
                  {booking.artisan_name}
                </>
              )}
            </div>
          </div>
          <StatePill state={booking.lifecycle_state} />
        </div>

        {/* Lifecycle Timeline */}
        <Card className="p-6 bg-[#0F0720] border border-fuchsia-500/20 rounded-2xl mb-6">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-300/80 mb-4">
            Escrow Lifecycle
          </p>
          <div className="grid md:grid-cols-4 gap-3" data-testid="vv-lifecycle-timeline">
            {LIFECYCLE_STEPS.map((step, i) => {
              const reached = reachedIdx >= i || booking.lifecycle_state === "paid_out";
              const Icon = step.icon;
              return (
                <div
                  key={step.state}
                  className={`p-4 rounded-2xl border transition-all ${
                    reached
                      ? "border-fuchsia-400/60 bg-fuchsia-500/10"
                      : "border-fuchsia-500/15 bg-[#0B0618]"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 mb-2 ${reached ? "text-fuchsia-300" : "text-purple-300/40"}`}
                  />
                  <p
                    className={`text-sm font-black ${
                      reached ? "text-white" : "text-purple-300/40"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-purple-300/60 mt-1">
                    {step.state}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Pricing breakdown */}
        <Card className="p-6 bg-[#0F0720] border border-fuchsia-500/20 rounded-2xl mb-6">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-300/80 mb-4">
            Pricing Breakdown
          </p>
          <div className="space-y-2 text-sm" data-testid="vv-pricing-breakdown">
            <Row label={`House rental (${booking.block_hours} hr)`} value={`$${p.house_rental_total_usd}`} />
            <Row label="  Platform fee (20%)" value={`-$${p.platform_fee_usd}`} muted />
            <Row label="  Host payout" value={`$${p.host_payout_usd}`} muted />
            {p.artisan_service_total_usd > 0 && (
              <>
                <Row
                  label={`Artisan service (${booking.artisan_name})`}
                  value={`$${p.artisan_service_total_usd}`}
                />
                <Row label="  Prep-fee (30%, non-refundable)" value={`$${p.artisan_prep_fee_usd}`} muted />
                <Row label="  Balance (held until Vibe-Check)" value={`$${p.artisan_balance_usd}`} muted />
              </>
            )}
            <div className="pt-3 mt-3 border-t border-fuchsia-500/20 flex justify-between items-center">
              <span className="text-fuchsia-300 font-black uppercase tracking-wider text-sm">
                Grand Total
              </span>
              <span className="text-3xl font-black text-white" data-testid="vv-grand-total">
                ${p.grand_total_usd}
              </span>
            </div>
          </div>
        </Card>

        {/* Action zone */}
        {booking.lifecycle_state === "pending" && isCustomer && (
          <Card className="p-6 bg-[#0F0720] border border-fuchsia-400/40 rounded-2xl mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-5 h-5 text-fuchsia-300" />
              <h3 className="text-lg font-black">Lock Escrow</h3>
            </div>
            <p className="text-sm text-purple-200/80 mb-4">
              Sign with Solflare to lock <span className="text-white font-bold">${p.grand_total_usd}</span>{" "}
              in the platform vault. Funds release in stages: prep-fee to the chef on
              confirm, balance to host + chef when you submit your Vibe-Check.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <WalletMultiButton />
              <Button
                onClick={lockEscrow}
                disabled={busy || !connected}
                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold"
                data-testid="vv-lock-escrow-btn"
              >
                {busy ? "Signing…" : "Sign & Lock Escrow"}
              </Button>
            </div>
          </Card>
        )}

        {booking.lifecycle_state === "escrowed" && (
          <Card className="p-6 bg-[#0F0720] border border-fuchsia-400/40 rounded-2xl mb-6">
            <div className="flex items-center gap-2 mb-3">
              <ChefHat className="w-5 h-5 text-orange-300" />
              <h3 className="text-lg font-black">Confirm — Release Prep-Fee</h3>
            </div>
            <p className="text-sm text-purple-200/80 mb-4">
              The chef gets <span className="text-orange-300 font-bold">
              ${p.artisan_prep_fee_usd}</span> right now to buy groceries and prep the
              event. The remaining <span className="text-white font-bold">
              ${(p.host_payout_usd + p.artisan_balance_usd).toFixed(2)}</span> stays
              locked until your Vibe-Check.
            </p>
            <Button
              onClick={releasePrep}
              disabled={busy}
              className="bg-orange-500 hover:bg-orange-400 text-white font-bold"
              data-testid="vv-release-prep-btn"
            >
              {busy ? "Releasing…" : "Release Prep-Fee"}
            </Button>
          </Card>
        )}

        {(booking.lifecycle_state === "prep_released" ||
          booking.lifecycle_state === "in_progress" ||
          booking.lifecycle_state === "completed") && (
          <Card className="p-6 bg-[#0F0720] border border-fuchsia-400/40 rounded-2xl mb-6">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-fuchsia-300" />
              <h3 className="text-lg font-black">Submit Vibe-Check</h3>
            </div>
            <p className="text-sm text-purple-200/80 mb-4">
              How was it? Your review releases the remaining balance to host + chef.
            </p>
            <div className="flex items-center gap-1 mb-3" data-testid="vv-rating-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  className="p-1 transition-transform hover:scale-110"
                  data-testid={`vv-rating-${n}`}
                >
                  <Star
                    className={`w-7 h-7 ${
                      n <= rating ? "fill-yellow-400 text-yellow-400" : "text-purple-700"
                    }`}
                  />
                </button>
              ))}
            </div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Tell future guests how this venue + chef vibe is…"
              rows={3}
              className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/30 text-white mb-4"
              data-testid="vv-review-text"
            />
            <div className="flex gap-3 flex-wrap">
              <Button
                onClick={submitVibeCheck}
                disabled={busy}
                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold"
                data-testid="vv-vibecheck-btn"
              >
                {busy ? "Submitting…" : "Submit Vibe-Check & Release Balance"}
              </Button>
              <Button
                onClick={dispute}
                disabled={busy}
                variant="outline"
                className="border-red-400/40 text-red-300 hover:bg-red-500/10"
                data-testid="vv-dispute-btn"
              >
                <AlertTriangle className="w-4 h-4 mr-2" /> Open Dispute
              </Button>
            </div>
          </Card>
        )}

        {booking.lifecycle_state === "paid_out" && booking.review && (
          <Card className="p-6 bg-[#0F0720] border border-emerald-500/30 rounded-2xl mb-6">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              <h3 className="text-lg font-black">Vibe-Check Complete</h3>
            </div>
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`w-5 h-5 ${
                    n <= booking.review!.rating ? "fill-yellow-400 text-yellow-400" : "text-purple-700"
                  }`}
                />
              ))}
            </div>
            {booking.review.text && (
              <p className="text-sm text-purple-200/80 italic">"{booking.review.text}"</p>
            )}
          </Card>
        )}

        {booking.lifecycle_state === "disputed" && (
          <Card className="p-6 bg-[#0F0720] border border-red-500/40 rounded-2xl mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-300" />
              <h3 className="text-lg font-black">Dispute Open</h3>
            </div>
            <p className="text-sm text-purple-200/80">
              Founders & Crew have master-key access. They'll review the booking and
              resolve manually within 24 hrs. You'll get a notification.
            </p>
          </Card>
        )}

        {booking.escrow_tx_signature && (
          <p className="text-xs text-purple-300/60 mt-4 font-mono break-all">
            Escrow tx:{" "}
            <a
              href={`https://explorer.solana.com/tx/${booking.escrow_tx_signature}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="text-fuchsia-300 hover:underline"
            >
              {booking.escrow_tx_signature}
            </a>
          </p>
        )}

        {/* Vibe-Sync Architecture Phase chat — opens once escrow is locked
             so customer + artisan + host can finalize menu/decor/setup. */}
        {booking.lifecycle_state !== "pending" && (
          <div className="mt-6">
            <VibeSyncChat bookingId={booking.booking_id} myRole={isCustomer ? "customer" : "host"} />
          </div>
        )}
      </div>
    </div>
  );
}

const Row: React.FC<{ label: string; value: string; muted?: boolean }> = ({
  label,
  value,
  muted,
}) => (
  <div className={`flex justify-between ${muted ? "text-purple-300/70 text-xs pl-3" : ""}`}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

const StatePill: React.FC<{ state: string }> = ({ state }) => {
  const styles: Record<string, string> = {
    pending: "bg-purple-500/15 text-purple-200 border-purple-500/30",
    escrowed: "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/30",
    prep_released: "bg-orange-500/15 text-orange-200 border-orange-500/30",
    in_progress: "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
    completed: "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
    paid_out: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
    cancelled: "bg-gray-500/15 text-gray-300 border-gray-500/30",
    disputed: "bg-red-500/15 text-red-200 border-red-500/30",
  };
  return (
    <span
      className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border ${
        styles[state] ?? styles.pending
      }`}
      data-testid="vv-state-pill"
    >
      {state.replace("_", " ")}
    </span>
  );
};
