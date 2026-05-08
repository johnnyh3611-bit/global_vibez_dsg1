/**
 * Founders & Crew — Vibe Venues Dispute Resolution Panel.
 * Master-key admin tool: shows all booked rooms in 'disputed' state,
 * one-click release-funds or refund.
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, X, ArrowLeft } from "lucide-react";
import { adminAPI } from "@/utils/adminAPI";
import { toast } from "sonner";

type Dispute = {
  booking_id: string;
  venue_name: string;
  customer_user_id: string;
  artisan_id?: string | null;
  artisan_name?: string | null;
  start_at: string;
  block_hours: number;
  pricing: {
    grand_total_usd: number;
    house_rental_total_usd: number;
    artisan_service_total_usd: number;
  };
  dispute_reason?: string;
  created_at: string;
};

export default function VibeVenuesDisputeAdmin() {
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await adminAPI.fetchWithAuth(`/api/vibe-venues/admin/disputes`);
      if (r.ok) {
        const data = await r.json();
        setDisputes(data.disputes || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const resolve = async (booking_id: string, resolution: "release" | "refund") => {
    const note = prompt(`Note for ${resolution.toUpperCase()} (visible to all parties):`);
    if (note === null) return;
    setBusyId(booking_id);
    try {
      const r = await adminAPI.fetchWithAuth(
        `/api/vibe-venues/admin/disputes/${booking_id}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolution, note }),
        },
      );
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.detail || "Resolution failed");
      }
      toast.success(`Booking ${resolution === "release" ? "released" : "refunded"}`);
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#07030F] text-white pb-24" data-testid="vv-dispute-admin-page">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <button
          onClick={() => navigate("/vibe-vault-admin")}
          className="flex items-center gap-2 text-purple-300/70 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Vibe Vault
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/40">
            <AlertTriangle className="w-7 h-7 text-red-300" />
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-red-300/90">
              Founders & Crew · Master-Key
            </p>
            <h1 className="text-3xl md:text-4xl font-black">Dispute Resolution</h1>
          </div>
        </div>
        <p className="text-sm text-purple-300/80 mb-8 max-w-2xl">
          All Vibe Venues bookings currently flagged with a dispute. Resolve by
          releasing escrowed funds to the host + artisan, or refunding the
          customer. Every action is logged on the booking's lifecycle history.
        </p>

        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : disputes.length === 0 ? (
          <Card className="p-12 text-center bg-[#0F0720] border border-emerald-500/20">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
            <h3 className="text-xl font-bold mb-2">No disputes</h3>
            <p className="text-purple-300/70 text-sm">
              All bookings are flowing through the lifecycle cleanly.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {disputes.map((d) => (
              <Card
                key={d.booking_id}
                className="p-5 bg-[#0F0720] border border-red-500/30 rounded-2xl"
                data-testid={`vv-dispute-${d.booking_id}`}
              >
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex-1 min-w-[260px]">
                    <p className="text-base font-black text-white">
                      {d.venue_name}
                    </p>
                    <p className="text-xs text-purple-300/70 mt-1 font-mono">
                      {d.booking_id}
                    </p>
                    <p className="text-sm text-purple-200/85 mt-2">
                      Customer: <span className="font-mono">{d.customer_user_id}</span>
                      {d.artisan_name ? ` · Artisan: ${d.artisan_name}` : ""}
                    </p>
                    <p className="text-xs text-purple-300/70 mt-1">
                      {new Date(d.start_at).toLocaleString()} · {d.block_hours} hr
                      block · grand_total $
                      {d.pricing.grand_total_usd}
                    </p>
                    {d.dispute_reason && (
                      <div className="mt-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                        <p className="text-xs uppercase tracking-widest text-red-300/90 mb-1 font-mono">
                          Reason
                        </p>
                        <p className="text-sm text-red-100/85 italic">
                          "{d.dispute_reason}"
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 min-w-[180px]">
                    <Button
                      onClick={() => resolve(d.booking_id, "release")}
                      disabled={busyId === d.booking_id}
                      className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold"
                      data-testid={`vv-dispute-release-${d.booking_id}`}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Release Funds
                    </Button>
                    <Button
                      onClick={() => resolve(d.booking_id, "refund")}
                      disabled={busyId === d.booking_id}
                      variant="outline"
                      className="border-red-400/40 text-red-300 hover:bg-red-500/10"
                      data-testid={`vv-dispute-refund-${d.booking_id}`}
                    >
                      <X className="w-4 h-4 mr-2" /> Refund Customer
                    </Button>
                    <Button
                      onClick={() =>
                        navigate(`/vibe-venues/booking/${d.booking_id}`)
                      }
                      variant="outline"
                      className="border-fuchsia-500/30 text-purple-200"
                    >
                      View Booking
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
