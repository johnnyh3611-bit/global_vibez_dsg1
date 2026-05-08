import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, X, MapPin, Phone } from 'lucide-react';
import { authFetch } from '@/utils/secureAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminSOS() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [filter]);

  const fetchAlerts = async () => {
    setErrorMessage('');
    try {
      const response = await authFetch(`${API}/admin/sos/alerts?status=${filter}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setErrorMessage(
          response.status === 403
            ? 'Admin access required.'
            : data.detail || `Request failed (${response.status})`
        );
        return;
      }
      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (error) {
      setErrorMessage('Network error — could not reach the SOS API.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (alertId) => {
    const notes = prompt('Resolution notes:');
    if (!notes) return;

    try {
      const response = await authFetch(`${API}/admin/sos/alerts/${alertId}/resolve?notes=${encodeURIComponent(notes)}`, {
        method: 'POST',
      });
      if (response.ok) {
        alert('Alert marked as resolved');
        fetchAlerts();
      }
    } catch (error) {
      // // console.error('Error resolving alert:', error);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">🚨 SOS Alert Monitoring</h1>
        <p className="text-gray-400">Critical emergency alerts requiring immediate attention</p>
      </div>

      {errorMessage && (
        <Card className="bg-red-900/30 border-2 border-red-500/40 p-4 mb-6" data-testid="admin-sos-error">
          <p className="text-red-200 text-sm">{errorMessage}</p>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {['pending', 'resolved', 'all'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-xl font-semibold transition-all ${
              filter === status
                ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white'
                : 'bg-black/40 text-gray-400 hover:text-white'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {loading ? (
          <Card className="bg-black/60 backdrop-blur-xl border-2 border-cyan-500/30 p-8 text-center text-gray-400">
            Loading alerts...
          </Card>
        ) : alerts.length === 0 ? (
          <Card className="bg-black/60 backdrop-blur-xl border-2 border-cyan-500/30 p-8 text-center text-gray-400">
            No {filter} alerts
          </Card>
        ) : (
          alerts.map((alert) => (
            <Card
              key={alert.alert_id}
              className={`bg-black/60 backdrop-blur-xl border-2 p-6 ${
                alert.status === 'pending'
                  ? 'border-red-500/50 shadow-lg shadow-red-500/20'
                  : 'border-cyan-500/30'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    alert.status === 'pending' ? 'bg-red-600' : 'bg-green-600'
                  }`}>
                    {alert.status === 'pending' ? (
                      <AlertTriangle className="w-6 h-6 text-white" />
                    ) : (
                      <CheckCircle className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      {alert.alert_type === 'panic' ? '🆘 PANIC ALERT' : 'Emergency Alert'}
                    </h3>
                    <p className="text-gray-400 text-sm">User ID: {alert.user_id}</p>
                    <p className="text-gray-400 text-sm">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  alert.status === 'pending'
                    ? 'bg-red-600/20 text-red-400 border border-red-500/50'
                    : 'bg-green-600/20 text-green-400 border border-green-500/50'
                }`}>
                  {alert.status}
                </span>
              </div>

              {alert.location && (
                <div className="flex items-center gap-2 text-cyan-400 mb-3">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">
                    Lat: {alert.location.latitude?.toFixed(4)}, Lng: {alert.location.longitude?.toFixed(4)}
                  </span>
                </div>
              )}

              {alert.ride_id && (
                <p className="text-white text-sm mb-3">
                  🚗 Ride ID: <span className="text-cyan-400">{alert.ride_id}</span>
                </p>
              )}

              {alert.status === 'pending' && (
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => handleResolve(alert.alert_id)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark as Resolved
                  </Button>
                  {alert.ride_id && (
                    <Button
                      onClick={() => window.open(`/rides/track/${alert.ride_id}`, '_blank')}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white"
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      Track Ride
                    </Button>
                  )}
                </div>
              )}

              {alert.status === 'resolved' && alert.resolution_notes && (
                <div className="mt-3 p-3 bg-green-600/10 border border-green-500/30 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Resolution Notes:</p>
                  <p className="text-sm text-white">{alert.resolution_notes}</p>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
