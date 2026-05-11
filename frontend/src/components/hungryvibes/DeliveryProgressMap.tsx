/**
 * DeliveryProgressMap — stylized SVG map showing courier progress from
 * restaurant → customer. Used in the customer-side order tracking page so
 * users can SEE where their food is at a glance.
 *
 * Currently uses CSS-driven animation pinned to order status (no live courier
 * GPS yet — courier app sends pings is a v1.1 enhancement). The interface is
 * designed so plugging in real lat/lng pings is a 10-line change: replace the
 * `courierProgress` derivation with a backend-fed normalized 0..1 value.
 */
import { useMemo } from "react";
import { MapPin, Pizza, Bike } from "lucide-react";

interface Props {
  status: "pending" | "paid" | "preparing" | "ready" | "delivered" | "rejected";
  orderId: string;
}

const STATUS_PROGRESS: Record<Props["status"], number> = {
  pending: 0,
  paid: 0,
  preparing: 0.1,
  ready: 0.55,
  delivered: 1,
  rejected: 0,
};

const STATUS_LABEL: Record<Props["status"], string> = {
  pending: "Awaiting confirmation",
  paid: "Awaiting confirmation",
  preparing: "Chef firing your order",
  ready: "Courier en route",
  delivered: "Arrived at your door",
  rejected: "Order rejected",
};

export default function DeliveryProgressMap({ status, orderId }: Props) {
  // Path goes from bottom-left (restaurant) → curve → top-right (customer)
  const progress = STATUS_PROGRESS[status] ?? 0;

  // Compute courier position along a quadratic bezier
  // P0 = (40, 200), P1 = (240, 40), P2 = (440, 180)
  const { cx, cy } = useMemo(() => {
    const t = progress;
    const x = (1 - t) * (1 - t) * 40 + 2 * (1 - t) * t * 240 + t * t * 440;
    const y = (1 - t) * (1 - t) * 200 + 2 * (1 - t) * t * 40 + t * t * 180;
    return { cx: x, cy: y };
  }, [progress]);

  if (status === "rejected") return null;

  return (
    <div
      className="relative rounded-xl overflow-hidden border border-amber-400/15 bg-gradient-to-br from-[#0a1525] via-[#0d1d33] to-[#0a1525]"
      data-testid={`hv-delivery-map-${orderId}`}
    >
      {/* Map header */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Bike className="w-3.5 h-3.5 text-amber-300" />
          <span className="text-[11px] uppercase tracking-widest text-amber-200/80 font-bold">
            Live delivery
          </span>
        </div>
        <span className="text-[10px] text-amber-100/60 italic">
          {STATUS_LABEL[status]}
        </span>
      </div>

      {/* Stylized SVG map */}
      <svg
        viewBox="0 0 480 240"
        className="w-full h-44 bg-[#0a1525]"
        preserveAspectRatio="xMidYMid meet"
        aria-label="Delivery progress map"
      >
        <defs>
          <pattern id={`grid-${orderId}`} width="30" height="30" patternUnits="userSpaceOnUse">
            <path
              d="M 30 0 L 0 0 0 30"
              fill="none"
              stroke="rgba(251,191,36,0.05)"
              strokeWidth="0.5"
            />
          </pattern>
          <linearGradient id={`route-${orderId}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        <rect width="480" height="240" fill={`url(#grid-${orderId})`} />

        {/* Decorative "streets" */}
        <line x1="0" y1="80" x2="480" y2="80" stroke="rgba(255,255,255,0.04)" strokeWidth="14" />
        <line x1="0" y1="160" x2="480" y2="160" stroke="rgba(255,255,255,0.04)" strokeWidth="14" />
        <line x1="120" y1="0" x2="120" y2="240" stroke="rgba(255,255,255,0.04)" strokeWidth="14" />
        <line x1="320" y1="0" x2="320" y2="240" stroke="rgba(255,255,255,0.04)" strokeWidth="14" />

        {/* Route path (background) */}
        <path
          d="M 40 200 Q 240 40 440 180"
          fill="none"
          stroke="rgba(251,191,36,0.15)"
          strokeWidth="3"
          strokeDasharray="6 6"
        />

        {/* Route path (completed portion) */}
        <path
          d="M 40 200 Q 240 40 440 180"
          fill="none"
          stroke={`url(#route-${orderId})`}
          strokeWidth="3"
          strokeLinecap="round"
          pathLength="1"
          strokeDasharray={`${progress} 1`}
          style={{ transition: "stroke-dasharray 1.2s ease-out" }}
        />

        {/* Restaurant pin */}
        <g transform="translate(40,200)">
          <circle r="14" fill="#1a0d05" stroke="#fbbf24" strokeWidth="2" />
          <text x="0" y="4" textAnchor="middle" fontSize="14">🍕</text>
        </g>

        {/* Customer pin */}
        <g transform="translate(440,180)">
          <circle
            r="14"
            fill={status === "delivered" ? "#10b981" : "#1a0d05"}
            stroke={status === "delivered" ? "#10b981" : "#10b981"}
            strokeWidth="2"
          />
          <text x="0" y="4" textAnchor="middle" fontSize="14">
            {status === "delivered" ? "✅" : "🏠"}
          </text>
        </g>

        {/* Courier marker — animated along bezier */}
        {status !== "delivered" && (
          <g
            transform={`translate(${cx},${cy})`}
            style={{ transition: "transform 1.2s ease-out" }}
          >
            <circle r="13" fill="#f59e0b" opacity="0.4" className="animate-ping" />
            <circle r="9" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
            <text x="0" y="3.5" textAnchor="middle" fontSize="11">🛵</text>
          </g>
        )}
      </svg>

      {/* Legend strip */}
      <div className="flex items-center justify-between text-[10px] px-3 py-2 bg-black/30 border-t border-white/5 text-amber-100/70">
        <span className="flex items-center gap-1">
          <Pizza className="w-3 h-3" /> Restaurant
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" /> Your address
        </span>
      </div>
    </div>
  );
}
