import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '@/utils/secureAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FuturisticTabs } from '@/components/ui/futuristic-tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Truck, MapPin, Clock, ShieldAlert, Activity, Play, CheckCircle,
  Plus, RefreshCw, ArrowLeft, Navigation, AlertTriangle, Package,
  Hand, User
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const DUTY_STATUSES = [
  { id: 'OFF_DUTY', label: 'Off Duty', color: 'bg-green-600' },
  { id: 'SLEEPER_BERTH', label: 'Sleeper Berth', color: 'bg-blue-600' },
  { id: 'DRIVING', label: 'Driving', color: 'bg-red-600' },
  { id: 'ON_DUTY_NOT_DRIVING', label: 'On Duty (Not Driving)', color: 'bg-yellow-600' },
  { id: 'PERSONAL_USE', label: 'Personal Use', color: 'bg-purple-600' },
  { id: 'YARD_MOVE', label: 'Yard Move', color: 'bg-orange-600' },
];

export default function ELDDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [hos, setHos] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [availableLoads, setAvailableLoads] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<'loads' | 'available'>('loads');

  const [originName, setOriginName] = useState('');
  const [originAddress, setOriginAddress] = useState('');
  const [destName, setDestName] = useState('');
  const [destAddress, setDestAddress] = useState('');
  const [cargo, setCargo] = useState('');

  const isDriver = Boolean(driverProfile);
  const isCompany = Boolean(user && !driverProfile);

  useEffect(() => {
    loadAll();
    const interval = setInterval(() => {
      if (isDriver) loadHos();
    }, 30000);
    return () => clearInterval(interval);
  }, [isDriver]);

  const loadAll = async () => {
    setError('');
    try {
      await loadUser();
      await Promise.all([loadTrips(), loadDriver()]);
    } catch (err) {
      setError('Failed to load ELD dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const loadUser = async () => {
    const res = await authFetch(`${API}/api/auth/me`);
    if (res.ok) setUser(await res.json());
  };

  const loadDriver = async () => {
    const res = await authFetch(`${API}/api/drivers/me`);
    if (res.ok) {
      const data = await res.json();
      if (data.driver) {
        setDriverProfile(data.driver);
        await loadHos();
        await loadLogs();
        await loadAvailableLoads();
      }
    }
  };

  const loadHos = async () => {
    const res = await authFetch(`${API}/api/eld/hos`);
    if (!res.ok) return;
    setHos(await res.json());
  };

  const loadLogs = async () => {
    const res = await authFetch(`${API}/api/eld/logs?limit=20`);
    if (!res.ok) return;
    const data = await res.json();
    setLogs(data.logs || []);
  };

  const loadTrips = async () => {
    const res = await authFetch(`${API}/api/eld/trips?limit=50`);
    if (!res.ok) throw new Error('trips failed');
    const data = await res.json();
    setTrips(data.trips || []);
  };

  const loadAvailableLoads = async () => {
    const res = await authFetch(`${API}/api/eld/trips?available=true&limit=50`);
    if (!res.ok) return;
    const data = await res.json();
    setAvailableLoads(data.trips || []);
  };

  const getLocation = (): Promise<{ lat: number; lng: number; address?: string }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: 0, lng: 0, address: 'GPS unavailable' });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: 0, lng: 0, address: 'GPS unavailable' }),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const changeDutyStatus = async (status: string) => {
    setProcessing(true);
    setError('');
    try {
      const loc = await getLocation();
      const res = await authFetch(`${API}/api/eld/duty-status`, {
        method: 'POST',
        body: JSON.stringify({ status, location: loc }),
      });
      if (!res.ok) throw new Error('status change failed');
      await Promise.all([loadHos(), loadLogs()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status change failed');
    } finally {
      setProcessing(false);
    }
  };

  const createTrip = async () => {
    if (!originName || !destName) return;
    setProcessing(true);
    setError('');
    try {
      const res = await authFetch(`${API}/api/eld/trips`, {
        method: 'POST',
        body: JSON.stringify({
          origin: { name: originName, location: { lat: 0, lng: 0, address: originAddress } },
          destination: { name: destName, location: { lat: 0, lng: 0, address: destAddress } },
          cargo_description: cargo,
        }),
      });
      if (!res.ok) throw new Error('Load creation failed');
      setShowCreate(false);
      setOriginName('');
      setOriginAddress('');
      setDestName('');
      setDestAddress('');
      setCargo('');
      await loadTrips();
      if (isDriver) await loadAvailableLoads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load creation failed');
    } finally {
      setProcessing(false);
    }
  };

  const assignLoad = async (tripId: string) => {
    setProcessing(true);
    try {
      const res = await authFetch(`${API}/api/eld/trips/${tripId}/assign`, { method: 'POST' });
      if (!res.ok) throw new Error('assign failed');
      await Promise.all([loadTrips(), loadAvailableLoads()]);
    } finally {
      setProcessing(false);
    }
  };

  const startTrip = async (tripId: string) => {
    setProcessing(true);
    try {
      const res = await authFetch(`${API}/api/eld/trips/${tripId}/start`, { method: 'POST' });
      if (!res.ok) throw new Error('start failed');
      await loadTrips();
    } finally {
      setProcessing(false);
    }
  };

  const completeTrip = async (tripId: string) => {
    setProcessing(true);
    try {
      const res = await authFetch(`${API}/api/eld/trips/${tripId}/complete`, { method: 'POST' });
      if (!res.ok) throw new Error('complete failed');
      await loadTrips();
    } finally {
      setProcessing(false);
    }
  };

  const pingLocation = async (tripId: string) => {
    setProcessing(true);
    try {
      const loc = await getLocation();
      const res = await authFetch(`${API}/api/eld/trips/${tripId}/location`, {
        method: 'POST',
        body: JSON.stringify({ location: loc }),
      });
      if (!res.ok) throw new Error('ping failed');
      await loadTrips();
    } finally {
      setProcessing(false);
    }
  };

  const formatMinutes = (mins: number) => {
    const h = Math.floor(Math.max(0, mins) / 60);
    const m = Math.floor(Math.max(0, mins) % 60);
    return `${h}h ${m}m`;
  };

  const statusMeta = DUTY_STATUSES.find((s) => s.id === hos?.status) || DUTY_STATUSES[0];

  const renderTripActions = (trip: any, isAvailable = false) => {
    if (isAvailable) {
      return (
        <Button
          size="sm"
          onClick={() => assignLoad(trip.trip_id)}
          disabled={processing}
          className="bg-cyan-600 hover:bg-cyan-700 text-white"
        >
          <Hand className="w-4 h-4 mr-1" />
          Pick Load
        </Button>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        {trip.status === 'planned' && (
          <Button
            size="sm"
            onClick={() => startTrip(trip.trip_id)}
            disabled={processing}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Play className="w-4 h-4 mr-1" />
            Start
          </Button>
        )}
        {trip.status === 'assigned' && (
          <Button
            size="sm"
            onClick={() => startTrip(trip.trip_id)}
            disabled={processing}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Play className="w-4 h-4 mr-1" />
            Start
          </Button>
        )}
        {trip.status === 'active' && (
          <>
            <Button
              size="sm"
              onClick={() => pingLocation(trip.trip_id)}
              disabled={processing}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              <Navigation className="w-4 h-4 mr-1" />
              Ping
            </Button>
            <Button
              size="sm"
              onClick={() => completeTrip(trip.trip_id)}
              disabled={processing}
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
          className="border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10"
        >
          Track
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 flex items-center justify-center">
        <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 p-4 sm:p-6 pb-24">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate('/vibe-ridez')}
              className="text-white hover:bg-white/10 px-0 mb-2"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <h1 className="text-3xl sm:text-4xl font-black text-white flex items-center gap-3">
              <Truck className="w-8 h-8 text-cyan-400" />
              Vibe Fleet ELD
            </h1>
            <p className="text-white/60 mt-1">
              {isDriver
                ? 'FMCSA-ready Hours of Service logs with tamper-evident chain.'
                : 'Post loads and track your freight in real time.'}
            </p>
          </div>
          {isDriver && (
            <Badge className={`${statusMeta.color} text-white font-bold px-3 py-1`}>
              {statusMeta.label}
            </Badge>
          )}
          {isCompany && (
            <Badge className="bg-blue-600 text-white font-bold px-3 py-1 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Shipper
            </Badge>
          )}
        </div>

        {error && (
          <Card className="bg-red-900/30 border-red-500/40 p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <p className="text-red-200 text-sm">{error}</p>
          </Card>
        )}

        {isDriver && hos?.in_violation && (
          <Card className="bg-yellow-900/30 border-yellow-500/40 p-4 mb-6 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-yellow-400" />
            <p className="text-yellow-200 text-sm">{hos.violations.join(' • ')}</p>
          </Card>
        )}

        {isDriver && hos && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white/5 border-white/10 p-4">
              <p className="text-white/60 text-xs uppercase tracking-wider">Drive Left</p>
              <p className="text-2xl font-black text-white">{formatMinutes(hos.remaining_drive_minutes ?? 660)}</p>
            </Card>
            <Card className="bg-white/5 border-white/10 p-4">
              <p className="text-white/60 text-xs uppercase tracking-wider">Duty Window</p>
              <p className="text-2xl font-black text-white">{formatMinutes(hos.remaining_duty_window_minutes ?? 840)}</p>
            </Card>
            <Card className="bg-white/5 border-white/10 p-4">
              <p className="text-white/60 text-xs uppercase tracking-wider">70h / 8 Days</p>
              <p className="text-2xl font-black text-white">{formatMinutes(hos.remaining_8_day_on_duty_minutes ?? 4200)}</p>
            </Card>
            <Card className="bg-white/5 border-white/10 p-4">
              <p className="text-white/60 text-xs uppercase tracking-wider">30-min Break</p>
              <p className="text-2xl font-black text-white">{hos.break_required ? 'Due' : 'OK'}</p>
            </Card>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {isDriver && (
              <Card className="bg-white/5 border-white/10 p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  Change Duty Status
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {DUTY_STATUSES.map((s) => (
                    <Button
                      key={s.id}
                      disabled={processing || hos?.status === s.id}
                      onClick={() => changeDutyStatus(s.id)}
                      className={`${s.color} hover:opacity-90 text-white font-bold py-5`}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </Card>
            )}

            <Card className="bg-white/5 border-white/10 p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-cyan-400" />
                  {isDriver ? 'Loads' : 'My Loads'}
                </h2>
                <Button
                  onClick={() => setShowCreate(true)}
                  disabled={processing}
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isDriver ? 'New Load' : 'Post Load'}
                </Button>
              </div>

              {isDriver && (
                <div className="mb-4">
                  <FuturisticTabs
                    ariaLabel="Driver loads"
                    value={activeTab}
                    onChange={(v) => setActiveTab(v as typeof activeTab)}
                    options={[
                      { value: 'loads', label: 'My Trips' },
                      { value: 'available', label: 'Available Loads' },
                    ]}
                  />
                </div>
              )}

              {showCreate && (
                <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      placeholder="Origin name"
                      value={originName}
                      onChange={(e) => setOriginName(e.target.value)}
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
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
                    <Button onClick={createTrip} disabled={processing || !originName || !destName} className="bg-green-600 hover:bg-green-700 text-white">
                      Create
                    </Button>
                    <Button variant="ghost" onClick={() => setShowCreate(false)} className="text-white/70 hover:text-white">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {(() => {
                const list = isDriver && activeTab === 'available' ? availableLoads : trips;
                if (list.length === 0) {
                  return <p className="text-white/50 text-sm">No {isDriver && activeTab === 'available' ? 'available loads' : 'loads'} yet.</p>;
                }
                return (
                  <div className="space-y-3">
                    {list.map((trip) => (
                      <div
                        key={trip.trip_id}
                        className="bg-black/40 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-white font-bold">
                            {trip.origin?.name} → {trip.destination?.name}
                          </p>
                          <p className="text-white/60 text-sm">{trip.cargo_description || 'No cargo description'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-white/70 border-white/20">
                              {trip.status}
                            </Badge>
                            {trip.driver_id && (
                              <span className="text-cyan-400 text-xs flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {trip.driver_id}
                              </span>
                            )}
                          </div>
                        </div>
                        {renderTripActions(trip, isDriver && activeTab === 'available')}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </Card>
          </div>

          {isDriver && (
            <Card className="bg-white/5 border-white/10 p-6 h-fit">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                Recent Logs
              </h2>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div key={log.log_id} className="border-l-2 border-cyan-500/50 pl-3 py-1">
                    <p className="text-white font-bold text-sm">{log.status.replace(/_/g, ' ')}</p>
                    <p className="text-white/60 text-xs">{new Date(log.created_at).toLocaleTimeString()}</p>
                    {log.location?.address && (
                      <p className="text-cyan-400 text-xs flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {log.location.address}
                      </p>
                    )}
                  </div>
                ))}
                {logs.length === 0 && <p className="text-white/50 text-sm">No logs yet.</p>}
              </div>
            </Card>
          )}

          {!isDriver && (
            <Card className="bg-white/5 border-white/10 p-6 h-fit">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-cyan-400" />
                Shipper Tools
              </h2>
              <p className="text-white/70 text-sm mb-4">
                Post loads for drivers to pick. Use the Track button to share real-time location with your customers.
              </p>
              <Button
                onClick={() => setShowCreate(true)}
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
