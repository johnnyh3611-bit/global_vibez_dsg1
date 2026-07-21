/**
 * Vibe Fleet ELD — CDL / Hours-of-Service work dashboard.
 *
 * Driver-first: duty status + remaining clock above the fold,
 * active trip next, then loads / logs. Linked from the landing
 * globe CDL hub and the in-app Hub Switcher.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authFetch } from "@/utils/secureAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VibezTabStyle } from "@/components/ui/VibezTabStyle";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Truck,
  MapPin,
  Clock,
  ShieldAlert,
  Activity,
  Play,
  CheckCircle,
  Plus,
  RefreshCw,
  ArrowLeft,
  Navigation,
  AlertTriangle,
  Package,
  Hand,
  User,
  Gauge,
  ExternalLink,
} from "lucide-react";
import { setPreferredHub } from "@/hubs/hubRegistry";

const API = process.env.REACT_APP_BACKEND_URL;

const DUTY_STATUSES = [
  { id: "OFF_DUTY", label: "Off Duty", short: "Off", color: "bg-emerald-600", ring: "ring-emerald-400/50" },
  { id: "SLEEPER_BERTH", label: "Sleeper Berth", short: "Sleeper", color: "bg-sky-600", ring: "ring-sky-400/50" },
  { id: "DRIVING", label: "Driving", short: "Drive", color: "bg-rose-600", ring: "ring-rose-400/50" },
  { id: "ON_DUTY_NOT_DRIVING", label: "On Duty (Not Driving)", short: "On Duty", color: "bg-amber-600", ring: "ring-amber-400/50" },
  { id: "PERSONAL_USE", label: "Personal Use", short: "Personal", color: "bg-violet-600", ring: "ring-violet-400/50" },
  { id: "YARD_MOVE", label: "Yard Move", short: "Yard", color: "bg-orange-600", ring: "ring-orange-400/50" },
];

function formatMinutes(mins: number) {
  const h = Math.floor(Math.max(0, mins) / 60);
  const m = Math.floor(Math.max(0, mins) % 60);
  return `${h}h ${m}m`;
}

function hosTone(remaining: number, total: number) {
  const pct = total <= 0 ? 0 : remaining / total;
  if (pct <= 0.15) return { bar: "bg-rose-500", text: "text-rose-300" };
  if (pct <= 0.35) return { bar: "bg-amber-400", text: "text-amber-200" };
  return { bar: "bg-emerald-400", text: "text-emerald-200" };
}

function HosMeter({
  label,
  remaining,
  total,
  testId,
}: {
  label: string;
  remaining: number;
  total: number;
  testId: string;
}) {
  const pct = Math.max(0, Math.min(100, total > 0 ? (remaining / total) * 100 : 0));
  const tone = hosTone(remaining, total);
  return (
    <Card className="bg-white/5 border-white/10 p-4" data-testid={testId}>
      <p className="text-white/55 text-[10px] uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-black mt-1 tabular-nums ${tone.text}`}>
        {formatMinutes(remaining)}
      </p>
      <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${tone.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-white/35">{Math.round(pct)}% of window left</p>
    </Card>
  );
}

export default function ELDDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [hos, setHos] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [availableLoads, setAvailableLoads] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<"loads" | "available">("loads");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [originName, setOriginName] = useState("");
  const [originAddress, setOriginAddress] = useState("");
  const [destName, setDestName] = useState("");
  const [destAddress, setDestAddress] = useState("");
  const [cargo, setCargo] = useState("");

  const isDriver = Boolean(driverProfile);
  const isCompany = Boolean(user && !driverProfile);

  const activeTrip = useMemo(
    () => trips.find((t) => t.status === "active") || null,
    [trips],
  );

  useEffect(() => {
    setPreferredHub("cdl");
  }, []);

  const loadHos = useCallback(async () => {
    const res = await authFetch(`${API}/api/eld/hos`);
    if (!res.ok) return;
    setHos(await res.json());
  }, []);

  const loadLogs = useCallback(async () => {
    const res = await authFetch(`${API}/api/eld/logs?limit=20`);
    if (!res.ok) return;
    const data = await res.json();
    setLogs(data.logs || []);
  }, []);

  const loadTrips = useCallback(async () => {
    const res = await authFetch(`${API}/api/eld/trips?limit=50`);
    if (!res.ok) throw new Error("trips failed");
    const data = await res.json();
    setTrips(data.trips || []);
  }, []);

  const loadAvailableLoads = useCallback(async () => {
    const res = await authFetch(`${API}/api/eld/trips?available=true&limit=50`);
    if (!res.ok) return;
    const data = await res.json();
    setAvailableLoads(data.trips || []);
  }, []);

  const loadAll = useCallback(async () => {
    setError("");
    try {
      const meRes = await authFetch(`${API}/api/auth/me`);
      if (meRes.ok) setUser(await meRes.json());

      const driverRes = await authFetch(`${API}/api/drivers/me`);
      let hasDriver = false;
      if (driverRes.ok) {
        const data = await driverRes.json();
        if (data.driver) {
          hasDriver = true;
          setDriverProfile(data.driver);
          await Promise.all([loadHos(), loadLogs(), loadAvailableLoads()]);
        } else {
          setDriverProfile(null);
        }
      }
      await loadTrips();
      setLastRefresh(new Date());
      if (!hasDriver) {
        /* shipper / guest path */
      }
    } catch {
      setError("Failed to load ELD dashboard.");
    } finally {
      setLoading(false);
    }
  }, [loadAvailableLoads, loadHos, loadLogs, loadTrips]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!isDriver) return;
    const interval = setInterval(() => {
      void loadHos();
    }, 30000);
    return () => clearInterval(interval);
  }, [isDriver, loadHos]);

  const getLocation = (): Promise<{ lat: number; lng: number; address?: string }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: 0, lng: 0, address: "GPS unavailable" });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: 0, lng: 0, address: "GPS unavailable" }),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  };

  const changeDutyStatus = async (status: string) => {
    setProcessing(true);
    setError("");
    try {
      const loc = await getLocation();
      const res = await authFetch(`${API}/api/eld/duty-status`, {
        method: "POST",
        body: JSON.stringify({ status, location: loc }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.detail || "Status change failed");
      }
      await Promise.all([loadHos(), loadLogs()]);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status change failed");
    } finally {
      setProcessing(false);
    }
  };

  const createTrip = async () => {
    if (!originName || !destName) return;
    setProcessing(true);
    setError("");
    try {
      const res = await authFetch(`${API}/api/eld/trips`, {
        method: "POST",
        body: JSON.stringify({
          origin: { name: originName, location: { lat: 0, lng: 0, address: originAddress } },
          destination: { name: destName, location: { lat: 0, lng: 0, address: destAddress } },
          cargo_description: cargo,
        }),
      });
      if (!res.ok) throw new Error("Load creation failed");
      setShowCreate(false);
      setOriginName("");
      setOriginAddress("");
      setDestName("");
      setDestAddress("");
      setCargo("");
      await loadTrips();
      if (isDriver) await loadAvailableLoads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load creation failed");
    } finally {
      setProcessing(false);
    }
  };

  const assignLoad = async (tripId: string) => {
    setProcessing(true);
    setError("");
    try {
      const res = await authFetch(`${API}/api/eld/trips/${tripId}/assign`, { method: "POST" });
      if (!res.ok) throw new Error("Could not pick load");
      await Promise.all([loadTrips(), loadAvailableLoads()]);
      setActiveTab("loads");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setProcessing(false);
    }
  };

  const startTrip = async (tripId: string) => {
    setProcessing(true);
    setError("");
    try {
      const res = await authFetch(`${API}/api/eld/trips/${tripId}/start`, { method: "POST" });
      if (!res.ok) throw new Error("Could not start trip");
      await loadTrips();
      // Soft-nudge HOS to Driving without nesting another processing lock.
      if (hos?.status !== "DRIVING") {
        const loc = await getLocation();
        const dutyRes = await authFetch(`${API}/api/eld/duty-status`, {
          method: "POST",
          body: JSON.stringify({ status: "DRIVING", location: loc }),
        });
        if (dutyRes.ok) {
          await Promise.all([loadHos(), loadLogs()]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Start failed");
    } finally {
      setProcessing(false);
    }
  };

  const completeTrip = async (tripId: string) => {
    setProcessing(true);
    setError("");
    try {
      const res = await authFetch(`${API}/api/eld/trips/${tripId}/complete`, { method: "POST" });
      if (!res.ok) throw new Error("Could not complete trip");
      await loadTrips();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Complete failed");
    } finally {
      setProcessing(false);
    }
  };

  const pingLocation = async (tripId: string) => {
    setProcessing(true);
    setError("");
    try {
      const loc = await getLocation();
      const res = await authFetch(`${API}/api/eld/trips/${tripId}/location`, {
        method: "POST",
        body: JSON.stringify({ location: loc }),
      });
      if (!res.ok) throw new Error("Location ping failed");
      await loadTrips();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ping failed");
    } finally {
      setProcessing(false);
    }
  };

  const statusMeta = DUTY_STATUSES.find((s) => s.id === hos?.status) || DUTY_STATUSES[0];

  const renderTripActions = (trip: any, isAvailable = false) => {
    if (isAvailable) {
      return (
        <Button
          size="sm"
          onClick={() => assignLoad(trip.trip_id)}
          disabled={processing}
          data-testid={`eld-pick-${trip.trip_id}`}
          className="bg-cyan-600 hover:bg-cyan-700 text-white"
        >
          <Hand className="w-4 h-4 mr-1" />
          Pick Load
        </Button>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        {(trip.status === "planned" || trip.status === "assigned") && (
          <Button
            size="sm"
            onClick={() => startTrip(trip.trip_id)}
            disabled={processing}
            data-testid={`eld-start-${trip.trip_id}`}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Play className="w-4 h-4 mr-1" />
            Start
          </Button>
        )}
        {trip.status === "active" && (
          <>
            <Button
              size="sm"
              onClick={() => pingLocation(trip.trip_id)}
              disabled={processing}
              data-testid={`eld-ping-${trip.trip_id}`}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              <Navigation className="w-4 h-4 mr-1" />
              Ping GPS
            </Button>
            <Button
              size="sm"
              onClick={() => completeTrip(trip.trip_id)}
              disabled={processing}
              data-testid={`eld-complete-${trip.trip_id}`}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Complete
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/vibe-ridez/eld/track/${trip.trip_id}`)}
          data-testid={`eld-track-${trip.trip_id}`}
          className="border-cyan-400/50 text-cyan-300 hover:bg-cyan-400/10"
        >
          Track
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <div
        className="min-h-screen bg-[#070b10] flex items-center justify-center"
        data-testid="eld-dashboard-loading"
      >
        <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#070b10] text-white p-4 sm:p-6 pb-28"
      data-testid="eld-dashboard"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate("/vibe-ridez/driver-dashboard")}
              className="text-white/70 hover:text-white hover:bg-white/10 px-0 mb-2"
              data-testid="eld-back-driver"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Driver dashboard
            </Button>
            <h1 className="text-3xl sm:text-4xl font-black flex items-center gap-3">
              <Truck className="w-8 h-8 text-amber-300" />
              CDL · ELD Hub
            </h1>
            <p className="text-white/55 mt-1 max-w-xl text-sm">
              {isDriver
                ? "Hours of Service, duty status, and freight — your work clock for the road."
                : "Post loads and track freight. Register as a driver to unlock HOS logging."}
            </p>
            {lastRefresh && (
              <p className="text-[10px] text-white/35 mt-2 uppercase tracking-widest">
                Updated {lastRefresh.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDriver && (
              <Badge
                className={`${statusMeta.color} text-white font-bold px-3 py-1.5 ring-2 ${statusMeta.ring}`}
                data-testid="eld-current-status"
              >
                {statusMeta.label}
              </Badge>
            )}
            {isCompany && (
              <Badge className="bg-blue-600 text-white font-bold px-3 py-1.5 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Shipper
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setLoading(true);
                void loadAll();
              }}
              disabled={processing}
              data-testid="eld-refresh"
              className="border-white/20 text-white/80"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${processing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Quick links into the rest of the Ridez stack */}
        <div
          className="mb-6 flex flex-wrap gap-2"
          data-testid="eld-quick-links"
        >
          <Link
            to="/vibe-ridez/driver-dashboard"
            className="text-xs px-3 py-1.5 rounded-full border border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/10"
          >
            Driver home
          </Link>
          <Link
            to="/vibe-ridez/dispatch"
            className="text-xs px-3 py-1.5 rounded-full border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/10"
          >
            Dispatch
          </Link>
          <Link
            to="/smartstack"
            className="text-xs px-3 py-1.5 rounded-full border border-amber-400/30 text-amber-200 hover:bg-amber-500/10"
          >
            SmartStack earn
          </Link>
          <Link
            to="/vibe-ridez/become-a-driver"
            className="text-xs px-3 py-1.5 rounded-full border border-white/15 text-white/60 hover:bg-white/5 inline-flex items-center gap-1"
          >
            Become a driver <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {error && (
          <Card
            className="bg-red-900/30 border-red-500/40 p-4 mb-6 flex items-center gap-3"
            data-testid="eld-error"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-200 text-sm">{error}</p>
          </Card>
        )}

        {!isDriver && !isCompany && (
          <Card
            className="mb-6 border-amber-400/30 bg-amber-500/5 p-6"
            data-testid="eld-register-cta"
          >
            <h2 className="text-lg font-bold text-amber-100 flex items-center gap-2">
              <Gauge className="w-5 h-5" /> Get on the clock
            </h2>
            <p className="text-sm text-white/60 mt-2 max-w-lg">
              ELD Hours of Service unlock after you register as a Vibe Ridez driver.
              You can still post loads as a shipper below.
            </p>
            <Button
              onClick={() => navigate("/vibe-ridez/become-a-driver")}
              className="mt-4 bg-amber-400 text-black font-bold"
              data-testid="eld-become-driver"
            >
              Register as driver
            </Button>
          </Card>
        )}

        {isDriver && hos?.in_violation && (
          <Card
            className="bg-yellow-900/30 border-yellow-500/40 p-4 mb-6 flex items-start gap-3"
            data-testid="eld-violation-banner"
          >
            <ShieldAlert className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-100 font-bold text-sm">HOS violation</p>
              <p className="text-yellow-200/90 text-sm mt-0.5">
                {(hos.violations || []).join(" • ") || "Check your duty status."}
              </p>
            </div>
          </Card>
        )}

        {/* Active trip callout */}
        {activeTrip && (
          <Card
            className="mb-6 border-cyan-400/40 bg-gradient-to-r from-cyan-500/10 to-emerald-500/5 p-5"
            data-testid="eld-active-trip"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-cyan-300 font-bold">
                  Active trip
                </p>
                <p className="text-xl font-black text-white mt-1">
                  {activeTrip.origin?.name} → {activeTrip.destination?.name}
                </p>
                <p className="text-sm text-white/55 mt-1">
                  {activeTrip.cargo_description || "No cargo description"}
                </p>
              </div>
              {renderTripActions(activeTrip)}
            </div>
          </Card>
        )}

        {isDriver && hos && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6" data-testid="eld-hos-meters">
            <HosMeter
              label="Drive left"
              remaining={
                hos.driving_minutes_remaining ?? hos.remaining_drive_minutes ?? 660
              }
              total={660}
              testId="eld-hos-drive"
            />
            <HosMeter
              label="Duty window"
              remaining={
                hos.duty_window_minutes_remaining ??
                hos.remaining_duty_window_minutes ??
                840
              }
              total={840}
              testId="eld-hos-duty"
            />
            <HosMeter
              label="70h / 8 days"
              remaining={
                hos.cycle_70hr_minutes_remaining ??
                hos.remaining_8_day_on_duty_minutes ??
                4200
              }
              total={4200}
              testId="eld-hos-cycle"
            />
            <Card
              className={`border p-4 ${
                hos.requires_break || hos.break_required
                  ? "bg-rose-500/10 border-rose-400/40"
                  : "bg-white/5 border-white/10"
              }`}
              data-testid="eld-hos-break"
            >
              <p className="text-white/55 text-[10px] uppercase tracking-widest">30-min break</p>
              <p
                className={`text-2xl font-black mt-1 ${
                  hos.requires_break || hos.break_required ? "text-rose-300" : "text-emerald-200"
                }`}
              >
                {hos.requires_break || hos.break_required ? "Due now" : "OK"}
              </p>
              <p className="mt-3 text-[10px] text-white/35">
                {hos.requires_break || hos.break_required
                  ? "Switch to Off Duty or Sleeper before driving further."
                  : "Break requirement satisfied."}
              </p>
            </Card>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {isDriver && (
              <Card className="bg-white/5 border-white/10 p-5 sm:p-6" data-testid="eld-duty-panel">
                <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  Duty status
                </h2>
                <p className="text-xs text-white/45 mb-4">
                  One tap logs GPS + status. Current:{" "}
                  <span className="text-white font-semibold">{statusMeta.label}</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {DUTY_STATUSES.map((s) => {
                    const active = hos?.status === s.id;
                    return (
                      <Button
                        key={s.id}
                        disabled={processing || active}
                        onClick={() => changeDutyStatus(s.id)}
                        data-testid={`eld-duty-${s.id}`}
                        className={`${s.color} hover:opacity-90 text-white font-bold py-6 ${
                          active ? `ring-2 ${s.ring} opacity-100` : ""
                        }`}
                      >
                        <span className="sm:hidden">{s.short}</span>
                        <span className="hidden sm:inline">{s.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </Card>
            )}

            <Card className="bg-white/5 border-white/10 p-5 sm:p-6" data-testid="eld-loads-panel">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-cyan-400" />
                  {isDriver ? "Loads" : "My Loads"}
                </h2>
                <Button
                  onClick={() => setShowCreate(true)}
                  disabled={processing}
                  data-testid="eld-new-load"
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isDriver ? "New Load" : "Post Load"}
                </Button>
              </div>

              {isDriver && (
                <div className="mb-4">
                  <VibezTabStyle
                    ariaLabel="Driver loads"
                    value={activeTab}
                    onChange={(v) => setActiveTab(v as typeof activeTab)}
                    options={[
                      { value: "loads", label: `My Trips (${trips.length})` },
                      { value: "available", label: `Available (${availableLoads.length})` },
                    ]}
                  />
                </div>
              )}

              {showCreate && (
                <div
                  className="bg-black/40 border border-white/10 rounded-xl p-4 mb-4 space-y-3"
                  data-testid="eld-create-form"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      placeholder="Origin name"
                      value={originName}
                      onChange={(e) => setOriginName(e.target.value)}
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                      data-testid="eld-origin-name"
                    />
                    <Input
                      placeholder="Origin address"
                      value={originAddress}
                      onChange={(e) => setOriginAddress(e.target.value)}
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                    />
                    <Input
                      placeholder="Destination name"
                      value={destName}
                      onChange={(e) => setDestName(e.target.value)}
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                      data-testid="eld-dest-name"
                    />
                    <Input
                      placeholder="Destination address"
                      value={destAddress}
                      onChange={(e) => setDestAddress(e.target.value)}
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                    />
                  </div>
                  <Textarea
                    placeholder="Cargo description"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={createTrip}
                      disabled={processing || !originName || !destName}
                      data-testid="eld-create-submit"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Create
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowCreate(false)}
                      className="text-white/70 hover:text-white"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {(() => {
                const list = isDriver && activeTab === "available" ? availableLoads : trips;
                if (list.length === 0) {
                  return (
                    <p className="text-white/50 text-sm" data-testid="eld-loads-empty">
                      No {isDriver && activeTab === "available" ? "available loads" : "loads"} yet.
                    </p>
                  );
                }
                return (
                  <div className="space-y-3">
                    {list.map((trip) => (
                      <div
                        key={trip.trip_id}
                        data-testid={`eld-trip-${trip.trip_id}`}
                        className={`rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
                          trip.status === "active"
                            ? "bg-cyan-500/10 border-cyan-400/30"
                            : "bg-black/40 border-white/10"
                        }`}
                      >
                        <div>
                          <p className="text-white font-bold">
                            {trip.origin?.name} → {trip.destination?.name}
                          </p>
                          <p className="text-white/60 text-sm">
                            {trip.cargo_description || "No cargo description"}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-white/70 border-white/20 capitalize">
                              {trip.status}
                            </Badge>
                            {trip.driver_id && (
                              <span className="text-cyan-400 text-xs flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {String(trip.driver_id).slice(0, 10)}
                              </span>
                            )}
                          </div>
                        </div>
                        {renderTripActions(trip, isDriver && activeTab === "available")}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </Card>
          </div>

          {isDriver && (
            <Card className="bg-white/5 border-white/10 p-5 sm:p-6 h-fit" data-testid="eld-logs-panel">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                Duty log
              </h2>
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div
                    key={log.log_id}
                    className="border-l-2 border-cyan-500/50 pl-3 py-1"
                    data-testid={`eld-log-${log.log_id}`}
                  >
                    <p className="text-white font-bold text-sm">
                      {String(log.status || "").replace(/_/g, " ")}
                    </p>
                    <p className="text-white/55 text-xs">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                    </p>
                    {(log.location?.address ||
                      (log.location?.lat != null && log.location?.lng != null)) && (
                      <p className="text-cyan-400 text-xs flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {log.location?.address ||
                          `${Number(log.location.lat).toFixed(3)}, ${Number(log.location.lng).toFixed(3)}`}
                      </p>
                    )}
                  </div>
                ))}
                {logs.length === 0 && (
                  <p className="text-white/50 text-sm">No logs yet — set a duty status.</p>
                )}
              </div>
            </Card>
          )}

          {!isDriver && (
            <Card className="bg-white/5 border-white/10 p-5 sm:p-6 h-fit" data-testid="eld-shipper-panel">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-cyan-400" />
                Shipper tools
              </h2>
              <p className="text-white/65 text-sm mb-4">
                Post loads for drivers to pick. Use Track to share live location with customers.
              </p>
              <Button
                onClick={() => setShowCreate(true)}
                data-testid="eld-shipper-post"
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold"
              >
                <Plus className="w-4 h-4 mr-2" />
                Post New Load
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
