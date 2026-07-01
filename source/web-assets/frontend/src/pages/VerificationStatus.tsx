import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Clock, CheckCircle, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function VerificationStatus() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API}/api/verification/status`, {
      });

      if (!response.ok) throw new Error('Failed to fetch status');

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      // console.error('Error fetching status:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (status?.status) {
      case 'pending':
        return <Clock className="w-20 h-20 text-yellow-400" />;
      case 'approved':
        return <CheckCircle className="w-20 h-20 text-green-400" />;
      case 'denied':
        return <XCircle className="w-20 h-20 text-red-400" />;
      default:
        return <AlertCircle className="w-20 h-20 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (status?.status) {
      case 'pending':
        return 'from-yellow-500 to-orange-500';
      case 'approved':
        return 'from-green-500 to-emerald-500';
      case 'denied':
        return 'from-red-500 to-pink-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        {/* Status Card */}
        <Card className="p-8 bg-white/10 backdrop-blur-lg border-white/20 text-center">
          <div className="mb-6">{getStatusIcon()}</div>

          <h1 className="text-4xl font-bold text-white mb-4">
            {status?.status === 'pending' && 'Verification Pending'}
            {status?.status === 'approved' && 'Verified!'}
            {status?.status === 'denied' && 'Verification Denied'}
            {status?.status === 'unverified' && 'Not Verified'}
          </h1>

          <p className="text-xl text-white/80 mb-6">{status?.message}</p>

          {/* Details */}
          {status?.status !== 'unverified' && (
            <div className="bg-white/5 rounded-lg p-6 mb-6 text-left">
              <div className="space-y-3 text-white/90">
                <div className="flex justify-between">
                  <span>Document Type:</span>
                  <span className="font-semibold capitalize">
                    {status?.document_type?.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Submitted:</span>
                  <span className="font-semibold">
                    {new Date(status?.submitted_at).toLocaleDateString()}
                  </span>
                </div>
                {status?.verified_at && (
                  <div className="flex justify-between">
                    <span>Verified:</span>
                    <span className="font-semibold">
                      {new Date(status?.verified_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rejection Reason */}
          {status?.status === 'denied' && status?.rejection_reason && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-200 font-semibold mb-2">Reason for Denial:</p>
              <p className="text-red-100">{status.rejection_reason}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 justify-center">
            {status?.status === 'unverified' && (
              <Button
                onClick={() => navigate('/verification/upload')}
                className={`bg-gradient-to-r ${getStatusColor()} hover:opacity-90 text-white font-bold px-8 py-3`}
              >
                Start Verification
              </Button>
            )}

            {status?.status === 'denied' && (
              <Button
                onClick={() => navigate('/verification/upload')}
                className={`bg-gradient-to-r ${getStatusColor()} hover:opacity-90 text-white font-bold px-8 py-3`}
              >
                Resubmit Verification
              </Button>
            )}

            {status?.status === 'approved' && (
              <Button
                onClick={() => navigate('/dashboard')}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold px-8 py-3"
              >
                Go to Dashboard
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
