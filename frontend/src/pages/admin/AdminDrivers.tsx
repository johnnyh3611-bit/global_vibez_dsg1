import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, X, Car, FileText } from 'lucide-react';
import { authFetch } from '@/utils/secureAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminDrivers() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    setErrorMessage('');
    try {
      const response = await authFetch(`${API}/admin/drivers/pending`);
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
      setPending(data.pending_verifications || []);
    } catch (error) {
      setErrorMessage('Network error — could not reach the drivers API.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    if (!window.confirm('Approve this driver application?')) return;

    try {
      const response = await authFetch(`${API}/admin/drivers/${userId}/approve`, {
        method: 'POST',
      });
      if (response.ok) {
        alert('Driver approved!');
        fetchPending();
      }
    } catch (error) {
      // // console.error('Error approving driver:', error);
    }
  };

  const handleReject = async (userId) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;

    try {
      const response = await authFetch(`${API}/admin/drivers/${userId}/reject?reason=${encodeURIComponent(reason)}`, {
        method: 'POST',
      });
      if (response.ok) {
        alert('Driver application rejected');
        fetchPending();
      }
    } catch (error) {
      // // console.error('Error rejecting driver:', error);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">🚗 Driver Verification</h1>
        <p className="text-gray-400">Review and approve driver applications</p>
      </div>

      {errorMessage && (
        <Card className="bg-red-900/30 border-2 border-red-500/40 p-4 mb-6" data-testid="admin-drivers-error">
          <p className="text-red-200 text-sm">{errorMessage}</p>
        </Card>
      )}

      <div className="space-y-4">
        {loading ? (
          <Card className="bg-black/60 backdrop-blur-xl border-2 border-cyan-500/30 p-8 text-center text-gray-400">
            Loading applications...
          </Card>
        ) : pending.length === 0 ? (
          <Card className="bg-black/60 backdrop-blur-xl border-2 border-cyan-500/30 p-8 text-center text-gray-400">
            No pending driver applications
          </Card>
        ) : (
          pending.map((application) => (
            <Card key={application.user_id} className="bg-black/60 backdrop-blur-xl border-2 border-yellow-500/30 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-yellow-600 flex items-center justify-center">
                    <Car className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">Driver Application</h3>
                    <p className="text-gray-400 text-sm">User ID: {application.user_id}</p>
                    <p className="text-gray-400 text-sm">
                      Submitted: {new Date(application.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-600/20 text-yellow-400 border border-yellow-500/50">
                  Pending
                </span>
              </div>

              {application.documents && (
                <div className="mb-4 space-y-2">
                  <p className="text-white font-semibold mb-2">Documents:</p>
                  {application.documents.license && (
                    <div className="flex items-center gap-2 text-cyan-400">
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">Driver License: Uploaded</span>
                    </div>
                  )}
                  {application.documents.insurance && (
                    <div className="flex items-center gap-2 text-cyan-400">
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">Insurance: Uploaded</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => handleApprove(application.user_id)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve Driver
                </Button>
                <Button
                  onClick={() => handleReject(application.user_id)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
