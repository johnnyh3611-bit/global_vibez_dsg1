import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '@/utils/secureAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Store, Car, Users, CheckCircle, XCircle, Clock, MapPin, Mail, Phone,
  Utensils, Search, ArrowLeft, ShieldAlert, Loader2, Eye,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

type MerchantTab = 'restaurants' | 'drivers';

interface SubmitterInfo {
  name?: string;
  email?: string;
}

interface Restaurant {
  restaurant_id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
  cuisine_type?: string[];
  submitter_info?: SubmitterInfo;
  listing_status: string;
  average_rating?: number;
  review_count?: number;
  created_at: string;
  is_promoted?: boolean;
  subscription_active?: boolean;
}

interface Vehicle {
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  plate_number?: string;
  vehicle_type?: string;
}

interface DriverDocuments {
  license_url?: string;
  insurance_url?: string;
  registration_url?: string;
  background_check_status?: string;
}

interface Driver {
  driver_id: string;
  user_id: string;
  user_info?: SubmitterInfo;
  vehicle?: Vehicle;
  documents?: DriverDocuments;
  status: string;
  rating?: number;
  total_rides?: number;
  total_earnings?: number;
  available?: boolean;
  created_at: string;
  approved_at?: string;
  rejection_reason?: string;
}

interface RestaurantStats {
  total_restaurants: number;
  approved_restaurants: number;
  pending_restaurants: number;
  promoted_restaurants: number;
  total_reviews: number;
}

interface DriverStats {
  total_drivers: number;
  pending_drivers: number;
  approved_drivers: number;
  rejected_drivers: number;
  active_drivers: number;
}

export default function AdminMerchants() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<MerchantTab>('restaurants');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [restaurantStats, setRestaurantStats] = useState<RestaurantStats | null>(null);
  const [driverStats, setDriverStats] = useState<DriverStats | null>(null);

  const [pendingRestaurants, setPendingRestaurants] = useState<Restaurant[]>([]);
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [restaurantFilter, setRestaurantFilter] = useState('');

  const [pendingDrivers, setPendingDrivers] = useState<Driver[]>([]);
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [driverFilter, setDriverFilter] = useState('');

  const [selected, setSelected] = useState<Restaurant | Driver | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, restaurantFilter, driverFilter]);

  const loadData = async () => {
    setError('');
    setLoading(true);
    try {
      if (tab === 'restaurants') {
        await Promise.all([fetchRestaurantStats(), fetchRestaurants()]);
      } else {
        await Promise.all([fetchDriverStats(), fetchDrivers()]);
      }
    } catch (err) {
      setError('Failed to load merchant data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurantStats = async () => {
    const res = await authFetch(`${API}/api/restaurants/admin/stats`);
    if (!res.ok) throw new Error('stats failed');
    const data = await res.json();
    setRestaurantStats(data);
  };

  const fetchRestaurants = async () => {
    const [pendingRes, listRes] = await Promise.all([
      authFetch(`${API}/api/restaurants/admin/pending`),
      authFetch(`${API}/api/restaurants/admin/list?status=${restaurantFilter || ''}&limit=50`),
    ]);
    if (!pendingRes.ok || !listRes.ok) throw new Error('restaurants failed');
    const pendingData = await pendingRes.json();
    const listData = await listRes.json();
    setPendingRestaurants(pendingData.pending_restaurants || []);
    setAllRestaurants(listData.restaurants || []);
  };

  const fetchDriverStats = async () => {
    const res = await authFetch(`${API}/api/drivers/admin/stats`);
    if (!res.ok) throw new Error('driver stats failed');
    const data = await res.json();
    setDriverStats(data);
  };

  const fetchDrivers = async () => {
    const [pendingRes, listRes] = await Promise.all([
      authFetch(`${API}/api/drivers/admin/pending`),
      authFetch(`${API}/api/drivers/admin/list?status=${driverFilter || ''}&limit=50`),
    ]);
    if (!pendingRes.ok || !listRes.ok) throw new Error('drivers failed');
    const pendingData = await pendingRes.json();
    const listData = await listRes.json();
    setPendingDrivers(pendingData.pending_drivers || []);
    setAllDrivers(listData.drivers || []);
  };

  const handleApproveRestaurant = async (restaurant: Restaurant) => {
    setProcessing(true);
    setError('');
    try {
      const res = await authFetch(`${API}/api/restaurants/admin/approve`, {
        method: 'POST',
        body: JSON.stringify({
          restaurant_id: restaurant.restaurant_id,
          status: 'approved',
        }),
      });
      if (!res.ok) throw new Error('approve failed');
      setSelected(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectRestaurant = async (restaurant: Restaurant) => {
    if (!rejectionReason.trim()) return;
    setProcessing(true);
    setError('');
    try {
      const res = await authFetch(`${API}/api/restaurants/admin/approve`, {
        method: 'POST',
        body: JSON.stringify({
          restaurant_id: restaurant.restaurant_id,
          status: 'rejected',
          rejection_reason: rejectionReason,
        }),
      });
      if (!res.ok) throw new Error('reject failed');
      setSelected(null);
      setRejectionReason('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveDriver = async (driver: Driver) => {
    setProcessing(true);
    setError('');
    try {
      const res = await authFetch(`${API}/api/drivers/admin/approve`, {
        method: 'POST',
        body: JSON.stringify({ driver_id: driver.driver_id }),
      });
      if (!res.ok) throw new Error('approve failed');
      setSelected(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectDriver = async (driver: Driver) => {
    if (!rejectionReason.trim()) return;
    setProcessing(true);
    setError('');
    try {
      const res = await authFetch(`${API}/api/drivers/admin/reject`, {
        method: 'POST',
        body: JSON.stringify({
          driver_id: driver.driver_id,
          rejection_reason: rejectionReason,
        }),
      });
      if (!res.ok) throw new Error('reject failed');
      setSelected(null);
      setRejectionReason('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setProcessing(false);
    }
  };

  const isRestaurant = (item: Restaurant | Driver): item is Restaurant =>
    'restaurant_id' in item;

  const statusBadge = (status: string) => {
    const lower = status?.toLowerCase() || 'unknown';
    if (lower === 'approved') return <Badge className="bg-green-600 hover:bg-green-600">Approved</Badge>;
    if (lower === 'pending') return <Badge className="bg-yellow-600 hover:bg-yellow-600">Pending</Badge>;
    if (lower === 'rejected' || lower === 'denied') return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  };

  if (loading && !selected && !allRestaurants.length && !allDrivers.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-fuchsia-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-black p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate('/admin')}
              className="text-white hover:bg-white/10 mb-2 px-0"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin
            </Button>
            <h1 className="text-3xl sm:text-4xl font-black text-white">Merchant Operations</h1>
            <p className="text-white/60 mt-1">Manage Hungry Vibez restaurants and Vibe Ridez drivers.</p>
          </div>
          <div className="flex bg-black/40 rounded-xl p-1 border border-white/10">
            <button
              onClick={() => setTab('restaurants')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${
                tab === 'restaurants'
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Utensils className="w-4 h-4" />
              Hungry Vibez
            </button>
            <button
              onClick={() => setTab('drivers')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${
                tab === 'drivers'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Car className="w-4 h-4" />
              Vibe Ridez
            </button>
          </div>
        </div>

        {error && (
          <Card className="bg-red-900/30 border-red-500/40 p-4 mb-6 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <p className="text-red-200 text-sm">{error}</p>
          </Card>
        )}

        {tab === 'restaurants' ? (
          <MerchantView
            icon={<Store className="w-5 h-5" />}
            title="Hungry Vibez"
            stats={[
              { label: 'Total', value: restaurantStats?.total_restaurants ?? 0, icon: Store, color: 'text-white' },
              { label: 'Approved', value: restaurantStats?.approved_restaurants ?? 0, icon: CheckCircle, color: 'text-green-400' },
              { label: 'Pending', value: restaurantStats?.pending_restaurants ?? 0, icon: Clock, color: 'text-yellow-400' },
              { label: 'Promoted', value: restaurantStats?.promoted_restaurants ?? 0, icon: Search, color: 'text-purple-400' },
            ]}
            pending={pendingRestaurants}
            all={allRestaurants}
            filter={restaurantFilter}
            onFilterChange={setRestaurantFilter}
            onSelect={setSelected}
            statusBadge={statusBadge}
            formatDate={formatDate}
            filterOptions={[
              { value: '', label: 'All' },
              { value: 'approved', label: 'Approved' },
              { value: 'pending', label: 'Pending' },
              { value: 'rejected', label: 'Rejected' },
            ]}
          />
        ) : (
          <MerchantView
            icon={<Car className="w-5 h-5" />}
            title="Vibe Ridez"
            stats={[
              { label: 'Total', value: driverStats?.total_drivers ?? 0, icon: Users, color: 'text-white' },
              { label: 'Approved', value: driverStats?.approved_drivers ?? 0, icon: CheckCircle, color: 'text-green-400' },
              { label: 'Pending', value: driverStats?.pending_drivers ?? 0, icon: Clock, color: 'text-yellow-400' },
              { label: 'Active', value: driverStats?.active_drivers ?? 0, icon: Car, color: 'text-cyan-400' },
            ]}
            pending={pendingDrivers}
            all={allDrivers}
            filter={driverFilter}
            onFilterChange={setDriverFilter}
            onSelect={setSelected}
            statusBadge={statusBadge}
            formatDate={formatDate}
            filterOptions={[
              { value: '', label: 'All' },
              { value: 'approved', label: 'Approved' },
              { value: 'pending', label: 'Pending' },
              { value: 'rejected', label: 'Rejected' },
            ]}
          />
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <Card
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-950/95 border-white/10 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-black text-white">
                  {isRestaurant(selected) ? selected.name : `Driver ${selected.user_info?.name || selected.user_id}`}
                </h2>
                {isRestaurant(selected) && (
                  <p className="text-white/60 flex items-center gap-1 mt-1">
                    <MapPin className="w-4 h-4" />
                    {selected.address}, {selected.city}
                  </p>
                )}
              </div>
              {statusBadge(isRestaurant(selected) ? selected.listing_status : selected.status)}
            </div>

            <div className="space-y-4 text-white/80">
              {isRestaurant(selected) ? (
                <>
                  {selected.description && <p>{selected.description}</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selected.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-cyan-400" />
                        {selected.phone}
                      </div>
                    )}
                    {selected.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-cyan-400" />
                        {selected.email}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-cyan-400" />
                      Submitter: {selected.submitter_info?.name || 'Unknown'}
                      {selected.submitter_info?.email && ` (${selected.submitter_info.email})`}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      Submitted {formatDate(selected.created_at)}
                    </div>
                  </div>
                  {selected.cuisine_type && selected.cuisine_type.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selected.cuisine_type.map((c) => (
                        <Badge key={c} variant="secondary">{c}</Badge>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-white/50 text-sm">Driver</p>
                      <p className="font-bold">{selected.user_info?.name || 'Unknown'}</p>
                      <p className="text-sm text-white/60">{selected.user_info?.email}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-sm">Vehicle</p>
                      <p className="font-bold">
                        {selected.vehicle?.year} {selected.vehicle?.make} {selected.vehicle?.model}
                      </p>
                      <p className="text-sm text-white/60">
                        {selected.vehicle?.color} • {selected.vehicle?.plate_number} • {selected.vehicle?.vehicle_type}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/50 text-sm">Rating</p>
                      <p className="font-bold">{selected.rating ?? '—'} ({selected.total_rides ?? 0} rides)</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-sm">Earnings</p>
                      <p className="font-bold">{selected.total_earnings?.toFixed(2) ?? '0.00'}</p>
                    </div>
                  </div>
                  {selected.documents && (
                    <div className="space-y-2">
                      <p className="text-white/50 text-sm">Documents</p>
                      <div className="flex flex-wrap gap-2">
                        {selected.documents.license_url && (
                          <a href={selected.documents.license_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline text-sm">License</a>
                        )}
                        {selected.documents.insurance_url && (
                          <a href={selected.documents.insurance_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline text-sm">Insurance</a>
                        )}
                        {selected.documents.registration_url && (
                          <a href={selected.documents.registration_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline text-sm">Registration</a>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {((isRestaurant(selected) && selected.listing_status === 'pending') ||
              (!isRestaurant(selected) && selected.status === 'pending')) && (
              <div className="mt-6 space-y-4 border-t border-white/10 pt-6">
                <Textarea
                  placeholder="Rejection reason (required to reject)"
                  value={rejectionReason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectionReason(e.target.value)}
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                />
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() =>
                      isRestaurant(selected)
                        ? handleApproveRestaurant(selected)
                        : handleApproveDriver(selected)
                    }
                    disabled={processing}
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    Approve
                  </Button>
                  <Button
                    onClick={() =>
                      isRestaurant(selected)
                        ? handleRejectRestaurant(selected)
                        : handleRejectDriver(selected)
                    }
                    disabled={processing || !rejectionReason.trim()}
                    variant="destructive"
                    className="flex-1 font-bold"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                    Reject
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button variant="ghost" onClick={() => setSelected(null)} className="text-white/70 hover:text-white">
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

interface MerchantViewProps<T extends Restaurant | Driver> {
  icon: React.ReactNode;
  title: string;
  stats: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string }[];
  pending: T[];
  all: T[];
  filter: string;
  onFilterChange: (value: string) => void;
  onSelect: (item: T) => void;
  statusBadge: (status: string) => React.ReactNode;
  formatDate: (iso?: string) => string;
  filterOptions: { value: string; label: string }[];
}

function MerchantView<T extends Restaurant | Driver>({
  icon,
  title,
  stats,
  pending,
  all,
  filter,
  onFilterChange,
  onSelect,
  statusBadge,
  formatDate,
  filterOptions,
}: MerchantViewProps<T>) {
  const isRest = (item: T): item is T & Restaurant =>
    'restaurant_id' in item;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="bg-white/5 border-white/10 p-4">
              <Icon className={`w-6 h-6 mb-2 ${s.color}`} />
              <p className="text-white/60 text-xs uppercase tracking-wider">{s.label}</p>
              <p className="text-2xl font-black text-white">{s.value}</p>
            </Card>
          );
        })}
      </div>

      {pending.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
            {icon}
            Pending {title} ({pending.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.map((item) => (
              <Card
                key={isRest(item) ? item.restaurant_id : (item as Driver).driver_id}
                className="bg-white/5 border-white/10 p-4 hover:bg-white/10 transition cursor-pointer"
                onClick={() => onSelect(item)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-bold">
                      {isRest(item) ? item.name : (item as Driver).user_info?.name || (item as Driver).driver_id}
                    </h3>
                    <p className="text-white/60 text-sm mt-1">
                      {isRest(item)
                        ? `${item.city} • ${formatDate(item.created_at)}`
                        : `${(item as Driver).vehicle?.year || ''} ${(item as Driver).vehicle?.make || ''} ${(item as Driver).vehicle?.model || ''} • ${formatDate(item.created_at)}`}
                    </p>
                  </div>
                  {statusBadge(isRest(item) ? item.listing_status : (item as Driver).status)}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-cyan-400">
                  <Eye className="w-3 h-3" />
                  Review
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h2 className="text-xl font-bold text-white">All {title}</h2>
          <div className="flex items-center gap-2">
            <label className="text-white/60 text-sm">Filter:</label>
            <select
              value={filter}
              onChange={(e) => onFilterChange(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {all.length === 0 ? (
          <Card className="bg-white/5 border-white/10 p-8 text-center text-white/60">
            No {title.toLowerCase()} found for this filter.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {all.map((item) => (
              <Card
                key={isRest(item) ? item.restaurant_id : (item as Driver).driver_id}
                className="bg-white/5 border-white/10 p-4 hover:bg-white/10 transition cursor-pointer"
                onClick={() => onSelect(item)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-bold">
                      {isRest(item) ? item.name : (item as Driver).user_info?.name || (item as Driver).driver_id}
                    </h3>
                    <p className="text-white/60 text-sm mt-1">
                      {isRest(item)
                        ? `${item.city} • ${formatDate(item.created_at)}`
                        : `${(item as Driver).vehicle?.year || ''} ${(item as Driver).vehicle?.make || ''} ${(item as Driver).vehicle?.model || ''} • ${formatDate(item.created_at)}`}
                    </p>
                  </div>
                  {statusBadge(isRest(item) ? item.listing_status : (item as Driver).status)}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-cyan-400">
                  <Eye className="w-3 h-3" />
                  View details
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
