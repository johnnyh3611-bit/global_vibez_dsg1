/**
 * HungryVibes Order Tracking — customer-side live status page.
 *
 * 2026-05-12 founder ask (backlog #1): "Customer-side HungryVibes order
 * tracking — live status badge that updates 'Restaurant preparing → On
 * the way → Delivered' for the eating customer (mirrors what merchants
 * now have)."
 *
 * Polls /api/hungryvibes/orders/my every 6s. Shows each active order as
 * a vertical timeline with the current state highlighted. Archived (delivered
 * / rejected) orders collapse into a "Show past orders" expander.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Truck,
  Utensils,
  XCircle,
  Pizza,
} from "lucide-react";
import { authFetch } from "@/utils/secureAuth";
import DeliveryProgressMap from "@/components/hungryvibes/DeliveryProgressMap";
import PushNotificationsPrompt from "@/components/notifications/PushNotificationsPrompt";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const API = process.env.REACT_APP_BACKEND_URL;

interface OrderDoc {
  order_id: string;
  merchant_id: string;
  status: "pending" | "paid" | "preparing" | "ready" | "delivered" | "rejected";
  food_payout_usd: number;
  payment_method: "card" | "coins" | "test";
  is_test?: boolean;
  note?: string | null;
  created_at: string;
  status_history?: Record<string, string>;
}

const STAGES = [
  { key: "pending", label: "Order placed", icon: Clock },
  { key: "preparing", label: "Restaurant preparing", icon: Utensils },
  { key: "ready", label: "Ready · on the way", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
] as const;

const STAGE_ORDER: Record<string, number> = {
  pending: 0,
  paid: 0,
  preparing: 1,
  ready: 2,
  delivered: 3,
  rejected: -1,
};

export default function HungryVibezOrderTracking() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const { notify } = usePushNotifications();

  // Track per-order last-known status so we only notify on actual transitions.
  const prevStatusRef = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`${API}/api/hungryvibes/orders/my`);
      if (!res.ok) {
        setOrders([]);
        return;
      }
      const d = await res.json();
      const next: OrderDoc[] = d.orders || [];

      // Fire local browser notifications on status transitions.
      next.forEach((o) => {
        const prev = prevStatusRef.current[o.order_id];
        if (prev && prev !== o.status) {
          const STATUS_COPY: Record<string, { title: string; body: string }> = {
            preparing: {
              title: "Your order is being prepared",
              body: `Order #${o.order_id.slice(0, 6)} · the chef is firing it up.`,
            },
            ready: {
              title: "Your food is on the way",
              body: `Order #${o.order_id.slice(0, 6)} · courier en route.`,
            },
            delivered: {
              title: "Delivered — enjoy!",
              body: `Order #${o.order_id.slice(0, 6)} · arrived at your door.`,
            },
            rejected: {
              title: "Order rejected — refunded",
              body: `Order #${o.order_id.slice(0, 6)} · your coins have been returned.`,
            },
          };
          const copy = STATUS_COPY[o.status];
          if (copy) {
            notify(copy.title, { body: copy.body, url: "/hungryvibes/tracking" });
          }
        }
        prevStatusRef.current[o.order_id] = o.status;
      });

      setOrders(next);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [load]);

  const active = orders.filter((o) => !["delivered", "rejected"].includes(o.status));
  const archive = orders.filter((o) => ["delivered", "rejected"].includes(o.status));

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#1a0d05] via-[#0a0815] to-[#170a23] text-white px-4 py-6 md:px-8"
      data-testid="hv-tracking-page"
    >
      <div className="max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => navigate("/hungryvibes")}
          className="flex items-center gap-1 text-amber-200/70 hover:text-white text-sm mb-4"
          data-testid="hv-tracking-back"
        >
          <ArrowLeft className="w-4 h-4" /> HungryVibes
        </button>

        <p className="text-amber-200/70 uppercase tracking-[0.3em] text-xs font-bold mb-1">
          HungryVibes · Your Orders
        </p>
        <h1 className="text-3xl md:text-4xl font-black mb-6">Order Tracking</h1>

        {active.length > 0 && <PushNotificationsPrompt context="food order" />}

        {loading ? (
          <p className="text-amber-100/60 text-sm py-12 text-center">Loading…</p>
        ) : active.length === 0 && archive.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-10 text-center"
            data-testid="hv-tracking-empty"
          >
            <Pizza className="w-8 h-8 mx-auto text-amber-300 mb-3" />
            <p className="text-amber-100/80 mb-4">
              You haven't placed any orders yet.
            </p>
            <button
              type="button"
              onClick={() => navigate("/hungryvibes")}
              className="px-5 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-[#1a0d05] text-sm font-bold"
              data-testid="hv-tracking-browse"
            >
              Browse restaurants
            </button>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div className="space-y-4 mb-8" data-testid="hv-tracking-active-list">
                {active.map((o) => (
                  <OrderTimeline key={o.order_id} order={o} />
                ))}
              </div>
            )}

            {archive.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowArchive((v) => !v)}
                  data-testid="hv-tracking-toggle-archive"
                  className="text-[10px] uppercase tracking-widest text-amber-300/80 hover:text-white border border-amber-400/30 px-3 py-1 rounded-full mb-3"
                >
                  {showArchive ? "Hide" : "Show"} past orders · {archive.length}
                </button>
                {showArchive && (
                  <div className="space-y-3" data-testid="hv-tracking-archive-list">
                    {archive.map((o) => (
                      <ArchivedOrderRow key={o.order_id} order={o} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function OrderTimeline({ order }: { order: OrderDoc }) {
  const currentStage = STAGE_ORDER[order.status] ?? 0;
  return (
    <div
      className="rounded-2xl border border-amber-400/20 bg-black/40 backdrop-blur-md p-5"
      data-testid={`hv-tracking-order-${order.order_id}`}
    >
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <p className="text-amber-100 font-bold text-lg">
            ${order.food_payout_usd.toFixed(2)}
            {order.is_test && (
              <span className="ml-2 text-[9px] uppercase tracking-widest font-bold border border-violet-400/40 bg-violet-500/15 text-violet-200 px-1.5 py-0.5 rounded-full">
                TEST
              </span>
            )}
          </p>
          <p className="text-xs text-amber-100/60 mt-0.5">
            Order {order.order_id.slice(0, 8)} ·{" "}
            {new Date(order.created_at).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          {order.note && (
            <p className="text-xs text-amber-200/80 mt-1 italic">"{order.note}"</p>
          )}
        </div>
      </div>

      {/* Live delivery map */}
      <div className="mt-4">
        <DeliveryProgressMap status={order.status} orderId={order.order_id} />
      </div>

      <div className="space-y-3 mt-4">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isDone = idx <= currentStage;
          const isCurrent = idx === currentStage;
          const ts = order.status_history?.[`${stage.key}_at`];
          return (
            <div
              key={stage.key}
              className="flex items-center gap-3"
              data-testid={`hv-tracking-stage-${stage.key}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isCurrent
                    ? "border-amber-400 bg-amber-400 text-[#1a0d05] animate-pulse"
                    : isDone
                    ? "border-emerald-400 bg-emerald-400/20 text-emerald-200"
                    : "border-white/15 bg-white/5 text-white/30"
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-semibold ${
                    isCurrent ? "text-amber-200" : isDone ? "text-emerald-200" : "text-white/40"
                  }`}
                >
                  {stage.label}
                </p>
                {ts && (
                  <p className="text-[10px] text-white/40">
                    {new Date(ts).toLocaleString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ArchivedOrderRow({ order }: { order: OrderDoc }) {
  const isRejected = order.status === "rejected";
  return (
    <div
      className="rounded-xl border border-white/5 bg-black/30 p-3 flex items-center gap-3"
      data-testid={`hv-tracking-archive-${order.order_id}`}
    >
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center ${
          isRejected ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"
        }`}
      >
        {isRejected ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">
          {isRejected ? "Rejected · refunded" : "Delivered"} · ${order.food_payout_usd.toFixed(2)}
        </p>
        <p className="text-[10px] text-white/40">
          {new Date(order.created_at).toLocaleString([], {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
    </div>
  );
}
