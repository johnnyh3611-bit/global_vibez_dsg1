import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertCircle, Car, RefreshCw } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function DriverVerificationStatus() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API}/api/driver-verification/status`, {
      });

      if (!response.ok) {
        throw new Error('Failed to fetch driver verification status');
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      // console.error('Error fetching status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 bg-white/10 backdrop-blur-lg border-white/20 text-center">
          <XCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold text-white mb-4">Error Loading Status</h2>
          <p className="text-white/70 mb-6">{error}</p>
          <Button
            onClick={fetchStatus}
            className="bg-purple-500 hover:bg-purple-600"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  // Unverified - No submission yet
  if (status?.status === 'unverified') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full p-8 bg-white/10 backdrop-blur-lg border-white/20">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>

          <div className="text-center mb-8">
            <Car className="w-20 h-20 mx-auto mb-4 text-purple-300" />
            <h1 className="text-4xl font-bold text-white mb-3">Driver License Verification</h1>
            <p className="text-xl text-purple-200">
              Get verified to become a driver for Vibes Rides
            </p>
          </div>

          {!status?.age_verified && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-100">
                  <p className="font-semibold mb-1">Age Verification Required</p>
                  <p>You must complete age verification (18+) before applying for driver verification.</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white/5 rounded-lg p-6 mb-6">
            <p className="text-white/80 text-center">{status?.message}</p>
          </div>

          {status?.age_verified ? (
            <Button
              onClick={() => navigate('/driver-license-verification')}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-6 text-lg"
            >
              Start Driver Verification
            </Button>
          ) : (
            <Button
              onClick={() => navigate('/age-verification')}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-6 text-lg"
            >
              Complete Age Verification First
            </Button>
          )}
        </Card>
      </div>
    );
  }

  // Pending - Under review
  if (status?.status === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full p-8 bg-white/10 backdrop-blur-lg border-white/20">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>

          <div className="text-center mb-8">
            <Clock className="w-24 h-24 mx-auto mb-6 text-yellow-400 animate-pulse" />
            <h1 className="text-4xl font-bold text-white mb-3">Verification Pending</h1>
            <p className="text-xl text-yellow-200 mb-4">
              {status?.message}
            </p>
          </div>

          <div className="bg-white/5 rounded-lg p-6 mb-6">
            <div className="space-y-3 text-white/80">
              <div className="flex justify-between">
                <span className="font-semibold">Verification ID:</span>
                <span className="font-mono text-sm">{status?.verification_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Submitted:</span>
                <span>{new Date(status?.submitted_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Status:</span>
                <span className="text-yellow-400 font-bold">Under Review</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
            <p className="text-blue-100 text-sm text-center">
              We're reviewing your driver's license. You'll receive an email notification once the review is complete.
              Typical review time is 24-48 hours.
            </p>
          </div>

          <Button
            onClick={fetchStatus}
            variant="outline"
            className="w-full border-white/20 text-white hover:bg-white/10"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Status
          </Button>
        </Card>
      </div>
    );
  }

  // Approved
  if (status?.status === 'approved') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full p-8 bg-white/10 backdrop-blur-lg border-white/20">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>

          <div className="text-center mb-8">
            <CheckCircle className="w-24 h-24 mx-auto mb-6 text-green-400" />
            <h1 className="text-4xl font-bold text-white mb-3">Verification Approved!</h1>
            <p className="text-xl text-green-200 mb-4">
              {status?.message}
            </p>
          </div>

          <div className="bg-white/5 rounded-lg p-6 mb-6">
            <div className="space-y-3 text-white/80">
              <div className="flex justify-between">
                <span className="font-semibold">Verification ID:</span>
                <span className="font-mono text-sm">{status?.verification_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Approved On:</span>
                <span>{new Date(status?.verified_at).toLocaleString()}</span>
              </div>
              {status?.license_expiry_date && (
                <div className="flex justify-between">
                  <span className="font-semibold">License Expires:</span>
                  <span>{new Date(status.license_expiry_date).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-semibold">Status:</span>
                <span className="text-green-400 font-bold">Verified ✓</span>
              </div>
            </div>
          </div>

          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
            <p className="text-green-100 text-sm text-center">
              Congratulations! You're now verified to register as a driver for Vibes Rides.
              Start earning by providing safe and fun rides to the Global Vibez DSG community!
            </p>
          </div>

          <Button
            onClick={() => navigate('/driver-registration')}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-6 text-lg"
          >
            <Car className="mr-2 h-5 w-5" />
            Register as Driver
          </Button>
        </Card>
      </div>
    );
  }

  // Denied
  if (status?.status === 'denied') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full p-8 bg-white/10 backdrop-blur-lg border-white/20">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>

          <div className="text-center mb-8">
            <XCircle className="w-24 h-24 mx-auto mb-6 text-red-400" />
            <h1 className="text-4xl font-bold text-white mb-3">Verification Denied</h1>
            <p className="text-xl text-red-200 mb-4">
              {status?.message}
            </p>
          </div>

          {status?.rejection_reason && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <h3 className="text-white font-semibold mb-2">Reason for Denial:</h3>
              <p className="text-red-100">{status.rejection_reason}</p>
            </div>
          )}

          <div className="bg-white/5 rounded-lg p-6 mb-6">
            <h3 className="text-white font-semibold mb-3">Common reasons for denial:</h3>
            <ul className="space-y-2 text-white/70 text-sm">
              <li>• Photo is blurry or text is not readable</li>
              <li>• Driver's license has expired</li>
              <li>• Selfie doesn't match the license photo</li>
              <li>• Document appears to be fake or altered</li>
            </ul>
          </div>

          <Button
            onClick={() => navigate('/driver-license-verification')}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-6 text-lg"
          >
            Resubmit Verification
          </Button>
        </Card>
      </div>
    );
  }

  return null;
}
