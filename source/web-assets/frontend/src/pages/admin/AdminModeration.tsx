import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, X } from 'lucide-react';
import { authFetch } from '@/utils/secureAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminModeration() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setErrorMessage('');
    try {
      const response = await authFetch(`${API}/admin/moderation/queue`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 403) {
          setErrorMessage('Admin access required.');
        } else {
          setErrorMessage(data.detail || `Request failed (${response.status})`);
        }
        return;
      }
      const data = await response.json();
      setReports(data.reports || []);
    } catch (error) {
      setErrorMessage('Network error — could not reach the moderation API.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (reportId) => {
    try {
      const response = await authFetch(`${API}/admin/moderation/${reportId}/approve`, {
        method: 'POST',
      });
      if (response.ok) {
        alert('Content approved');
        fetchQueue();
      }
    } catch (error) {
      // // console.error('Error approving content:', error);
    }
  };

  const handleRemove = async (reportId) => {
    if (!window.confirm('Remove this content? This action cannot be undone.')) return;

    try {
      const response = await authFetch(`${API}/admin/moderation/${reportId}/remove`, {
        method: 'POST',
      });
      if (response.ok) {
        alert('Content removed');
        fetchQueue();
      }
    } catch (error) {
      // // console.error('Error removing content:', error);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">🛡️ Content Moderation</h1>
        <p className="text-gray-400">Review reported content</p>
      </div>

      {errorMessage && (
        <Card
          className="bg-red-900/30 border-2 border-red-500/40 p-4 mb-6"
          data-testid="admin-moderation-error"
        >
          <p className="text-red-200 text-sm">{errorMessage}</p>
        </Card>
      )}

      <div className="space-y-4">
        {loading ? (
          <Card className="bg-black/60 backdrop-blur-xl border-2 border-cyan-500/30 p-8 text-center text-gray-400">
            Loading moderation queue...
          </Card>
        ) : reports.length === 0 ? (
          <Card className="bg-black/60 backdrop-blur-xl border-2 border-cyan-500/30 p-8 text-center text-gray-400">
            No reported content in queue
          </Card>
        ) : (
          reports.map((report) => (
            <Card key={report.report_id} className="bg-black/60 backdrop-blur-xl border-2 border-orange-500/30 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-600 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      {report.content_type || 'Content'} Reported
                    </h3>
                    <p className="text-gray-400 text-sm">Reported by: {report.reporter_id}</p>
                    <p className="text-gray-400 text-sm">Reason: {report.reason || 'Inappropriate content'}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleApprove(report.report_id)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve (No Violation)
                </Button>
                <Button
                  onClick={() => handleRemove(report.report_id)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <X className="w-4 h-4 mr-2" />
                  Remove Content
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
