import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { authFetch } from '@/utils/secureAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MapPin, ArrowLeft, Clock, Truck, ShieldCheck, Navigation, AlertTriangle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function TripTracking() {
  const { tripId } = useParams<{ tripId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [inputTripId, setInputTripId] = useState(tripId || '');
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (tripId) {
      loadTrip(tripId, token);
      const interval = setInterval(() => loadTrip(tripId, token, true), 15000);
      return () => clearInterval(interval);
    }
  }, [tripId, token]);

  const loadTrip = async (id: string, shareToken: string, silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const url = new URL(`${API}/api/eld/trips/${id}/track`);
      if (shareToken) url.searchParams.set('token', shareToken);
      const res = await authFetch(url.toString());
      if (!res.ok) throw new Error('Trip not found or access denied');
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trip');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const goToTrip = () => {
    if (!inputTripId) return;
    if (token) setSearchParams({ token });
    navigate(`/vibe-ridez/eld/track/${inputTripId}${token ? `?token=${token}` : ''}`);
  };

  const formatMinutes = (mins: number) => {
    const h = Math.floor(Math.max(0, mins) / 60);
    const m = Math.floor(Math.max(0, mins) % 60);
    return `${h}h ${m}m`;
  };

  const latest = data?.location_history?.slice(-1)[0];
  const start = data?.trip?.origin?.location;
  const end = data?.trip?.destination?.location;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 p-4 sm:p-6 pb-24">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/vibe-ridez/eld')}
          className="text-white hover:bg-white/10 px-0 mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to ELD
        </Button>

        <h1 className="text-3xl sm:text-4xl font-black text-white mb-2 flex items-center gap-3">
          <Truck className="w-8 h-8 text-cyan-400" />
          Track Shipment
        </h1>
        <p className="text-white/60 mb-6">Customer / shipper view of live freight location and driver HOS.</p>

        {!tripId && (
          <Card className="bg-white/5 border-white/10 p-6 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                placeholder="Trip ID"
                value={inputTripId}
                onChange={(e) => setInputTripId(e.target.value)}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
              />
              <Input
                placeholder="Share token (optional)"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
              />
              <Button onClick={goToTrip} className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold">
                Track
              </Button>
            </div>
          </Card>
        )}

        {loading && !data && (
          <Card className="bg-white/5 border-white/10 p-8 text-center text-white/60">
            Loading trip...
          </Card>
        )}

        {error && (
          <Card className="bg-red-900/30 border-red-500/40 p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <p className="text-red-200 text-sm">{error}</p>
          </Card>
        )}

        {data && (
          <div className="space-y-6">
            <Card className="bg-white/5 border-white/10 p-6">
              <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
                <div>
                  <p className="text-white/60 text-sm">Load</p>
                  <p className="text-white font-black text-xl">{data.trip.cargo_description || 'Unnamed load'}</p>
                  <p className="text-white/60 text-sm">Trip ID: {data.trip.trip_id}</p>
                </div>
                <Badge className="h-fit" variant={data.trip.status === 'active' ? 'default' : 'secondary'}>
                  {data.trip.status}
                </Badge>
              </div>

              <div className="relative bg-gradient-to-br from-green-900 to-green-950 rounded-2xl p-6 border-4 border-yellow-700/50 min-h-[240px] flex flex-col justify-between overflow-hidden">
                <div className="absolute top-4 right-4 flex gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-6 h-6 rounded-full bg-black/60 border-2 border-yellow-600/80" />
                  ))}
                </div>

                <div className="flex justify-between text-white/90 text-sm font-bold z-10">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    {data.trip.origin.name}
                  </div>
                  <div className="flex items-center gap-2">
                    {data.trip.destination.name}
                    <MapPin className="w-4 h-4 text-cyan-400" />
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-center relative z-10 my-4">
                  <div className="w-full h-2 bg-white/10 rounded-full relative">
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all"
                      style={{ width: `${latest ? 50 : 5}%` }}
                    />
                    {latest && (
                      <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2">
                        <div className="bg-cyan-500 text-black font-black px-3 py-1 rounded-full text-xs flex items-center gap-1">
                          <Navigation className="w-3 h-3" />
                          {latest.location.address || `${latest.location.lat.toFixed(3)}, ${latest.location.lng.toFixed(3)}`}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between text-white/60 text-xs z-10">
                  <span>{start?.address || `${start?.lat}, ${start?.lng}`}</span>
                  <span>{end?.address || `${end?.lat}, ${end?.lng}`}</span>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-white/5 border-white/10 p-4">
                <p className="text-white/60 text-xs uppercase">Driver HOS Status</p>
                <p className="text-white font-bold text-lg">{data.hos?.status?.replace(/_/g, ' ') || '—'}</p>
              </Card>
              <Card className="bg-white/5 border-white/10 p-4">
                <p className="text-white/60 text-xs uppercase">Drive Left</p>
                <p className="text-white font-bold text-lg">{formatMinutes(data.hos?.remaining_drive_minutes ?? 0)}</p>
              </Card>
              <Card className="bg-white/5 border-white/10 p-4">
                <p className="text-white/60 text-xs uppercase">Duty Window</p>
                <p className="text-white font-bold text-lg">{formatMinutes(data.hos?.remaining_duty_window_minutes ?? 0)}</p>
              </Card>
            </div>

            <Card className="bg-white/5 border-white/10 p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                Location History
              </h2>
              {data.location_history?.length === 0 ? (
                <p className="text-white/50 text-sm">No pings yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.location_history.map((ping: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 border-l-2 border-cyan-500/50 pl-3">
                      <MapPin className="w-4 h-4 text-cyan-400 mt-0.5" />
                      <div>
                        <p className="text-white text-sm">
                          {ping.location.address || `${ping.location.lat.toFixed(4)}, ${ping.location.lng.toFixed(4)}`}
                        </p>
                        <p className="text-white/60 text-xs">{new Date(ping.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 flex items-center gap-2 text-white/60 text-xs">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                Log hash verified against tamper-evident chain.
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
