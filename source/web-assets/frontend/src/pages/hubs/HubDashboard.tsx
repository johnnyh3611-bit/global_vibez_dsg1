/**
 * Brand / role hub shell — landing pad for VibeRise, Vineyards, Hungry, etc.
 * Links into the real working dashboards for that vertical.
 */
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getHub, setPreferredHub, type HubId } from "@/hubs/hubRegistry";
import HubSwitcher from "@/components/hubs/HubSwitcher";
import { useEffect } from "react";

export default function HubDashboard() {
  const { hubId } = useParams<{ hubId: string }>();
  const navigate = useNavigate();
  const hub = getHub(hubId);

  useEffect(() => {
    setPreferredHub(hub.id as HubId);
    // Dedicated dashboards (Ridez, CDL, Merchant…) skip the shell.
    if (hub.dashboardPath && !hub.dashboardPath.startsWith("/hub/")) {
      navigate(hub.dashboardPath, { replace: true });
    }
  }, [hub.id, hub.dashboardPath, navigate]);

  if (hub.dashboardPath && !hub.dashboardPath.startsWith("/hub/")) {
    return null;
  }

  return (
    <div
      className="min-h-screen bg-[#06050a] text-white"
      data-testid={`hub-dashboard-${hub.id}`}
    >
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-1.5 text-xs text-white/55 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Main home
          </button>
          <HubSwitcher />
        </div>

        <header className="mb-8">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/40">Work hub</p>
          <h1 className={`mt-2 text-3xl sm:text-4xl font-light ${hub.accent.split(" ")[0]}`}>
            {hub.label}
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/60">{hub.blurb}</p>
          <p className="mt-2 text-xs text-white/40">
            Tip: set this as your go-to from the landing globe — after login you land here.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2" data-testid="hub-quick-links">
          {hub.links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-white/25 hover:bg-white/[0.07]"
              data-testid={`hub-link-${l.to.replace(/\//g, "-")}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-semibold text-white">{l.label}</span>
                <ArrowRight className="h-4 w-4 text-white/40 group-hover:translate-x-0.5 group-hover:text-white transition" />
              </div>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
