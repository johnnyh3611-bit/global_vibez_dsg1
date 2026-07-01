import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, CheckCircle, XCircle, Clock, Users, TrendingUp, Eye } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminVerification() {
  const navigate = useNavigate();
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    status: 'approved',
    extracted_dob: '',
    verification_notes: '',
    rejection_reason: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch pending verifications
      const pendingRes = await fetch(`${API}/api/verification/admin/pending`, {
      });
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        setPendingVerifications(pendingData.verifications || []);
      }

      // Fetch stats
      const statsRes = await fetch(`${API}/api/verification/admin/stats`, {
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      // console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    if (!selectedVerification) return;

    try {
      const response = await fetch(`${API}/api/verification/admin/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          verification_id: selectedVerification.verification_id,
          ...reviewForm
        })
      });

      if (!response.ok) throw new Error('Failed to submit review');

      alert(`Verification ${reviewForm.status}!`);
      setSelectedVerification(null);
      setReviewForm({
        status: 'approved',
        extracted_dob: '',
        verification_notes: '',
        rejection_reason: ''
      });
      fetchData(); // Refresh data
    } catch (err) {
      // console.error('Error submitting review:', err);
      alert('Failed to submit review');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  // Review Modal
  if (selectedVerification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 p-6">
        <div className="max-w-5xl mx-auto">
          <Button
            onClick={() => setSelectedVerification(null)}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Queue
          </Button>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Images Column */}
            <div className="space-y-4">
              <Card className="p-4 bg-white/10 backdrop-blur-lg border-white/20">
                <h3 className="text-white font-semibold mb-3">ID Document</h3>
                <img
                  src={`${API}${selectedVerification.document_url}`}
                  alt="Document"
                  className="w-full rounded-lg"
                />
                <p className="text-white/60 text-sm mt-2 capitalize">
                  {selectedVerification.document_type.replace('_', ' ')}
                </p>
              </Card>

              <Card className="p-4 bg-white/10 backdrop-blur-lg border-white/20">
                <h3 className="text-white font-semibold mb-3">Selfie Photo</h3>
                <img
                  src={`${API}${selectedVerification.selfie_url}`}
                  alt="Selfie"
                  className="w-full rounded-lg"
                />
              </Card>
            </div>

            {/* Review Form Column */}
            <div>
              <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
                <h3 className="text-2xl font-bold text-white mb-4">Review Verification</h3>

                {/* User Info */}
                <div className="bg-white/5 rounded-lg p-4 mb-6">
                  <h4 className="text-white font-semibold mb-2">User Information</h4>
                  <div className="space-y-2 text-white/80 text-sm">
                    <div><span className="font-semibold">Name:</span> {selectedVerification.user_info?.name}</div>
                    <div><span className="font-semibold">Email:</span> {selectedVerification.user_info?.email}</div>
                    <div><span className="font-semibold">Submitted:</span> {new Date(selectedVerification.submitted_at).toLocaleString()}</div>
                  </div>
                </div>

                {/* Status Selection */}
                <div className="mb-4">
                  <label className="text-white font-semibold mb-2 block">Decision:</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setReviewForm({ ...reviewForm, status: 'approved' })}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        reviewForm.status === 'approved'
                          ? 'border-green-400 bg-green-500/30'
                          : 'border-white/20 bg-white/5'
                      }`}
                    >
                      <CheckCircle className={`w-6 h-6 mx-auto mb-1 ${
                        reviewForm.status === 'approved' ? 'text-green-400' : 'text-white/40'
                      }`} />
                      <p className="text-white font-semibold text-sm">Approve</p>
                    </button>
                    <button
                      onClick={() => setReviewForm({ ...reviewForm, status: 'denied' })}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        reviewForm.status === 'denied'
                          ? 'border-red-400 bg-red-500/30'
                          : 'border-white/20 bg-white/5'
                      }`}
                    >
                      <XCircle className={`w-6 h-6 mx-auto mb-1 ${
                        reviewForm.status === 'denied' ? 'text-red-400' : 'text-white/40'
                      }`} />
                      <p className="text-white font-semibold text-sm">Deny</p>
                    </button>
                  </div>
                </div>

                {/* Date of Birth (for approved) */}
                {reviewForm.status === 'approved' && (
                  <div className="mb-4">
                    <label className="text-white font-semibold mb-2 block">Date of Birth (from ID):</label>
                    <input
                      type="date"
                      value={reviewForm.extracted_dob}
                      onChange={(e) => setReviewForm({ ...reviewForm, extracted_dob: e.target.value })}
                      className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white"
                      required
                    />
                  </div>
                )}

                {/* Rejection Reason (for denied) */}
                {reviewForm.status === 'denied' && (
                  <div className="mb-4">
                    <label className="text-white font-semibold mb-2 block">Rejection Reason:</label>
                    <textarea
                      value={reviewForm.rejection_reason}
                      onChange={(e) => setReviewForm({ ...reviewForm, rejection_reason: e.target.value })}
                      placeholder="Explain why this verification was denied..."
                      className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white h-24"
                      required
                    />
                  </div>
                )}

                {/* Notes */}
                <div className="mb-6">
                  <label className="text-white font-semibold mb-2 block">Admin Notes (Optional):</label>
                  <textarea
                    value={reviewForm.verification_notes}
                    onChange={(e) => setReviewForm({ ...reviewForm, verification_notes: e.target.value })}
                    placeholder="Internal notes..."
                    className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white h-20"
                  />
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleReview}
                  className={`w-full font-bold py-4 ${
                    reviewForm.status === 'approved'
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                      : 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600'
                  }`}
                >
                  Submit {reviewForm.status === 'approved' ? 'Approval' : 'Denial'}
                </Button>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Button
              onClick={() => navigate('/dashboard')}
              variant="ghost"
              className="text-white hover:bg-white/10 mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <h1 className="text-4xl font-bold text-white">Verification Admin Dashboard</h1>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
              <Users className="w-8 h-8 text-blue-400 mb-2" />
              <p className="text-white/60 text-sm">Total Users</p>
              <p className="text-3xl font-bold text-white">{stats.total_users}</p>
            </Card>
            <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
              <CheckCircle className="w-8 h-8 text-green-400 mb-2" />
              <p className="text-white/60 text-sm">Verified Users</p>
              <p className="text-3xl font-bold text-white">{stats.verified_users}</p>
            </Card>
            <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
              <Clock className="w-8 h-8 text-yellow-400 mb-2" />
              <p className="text-white/60 text-sm">Pending</p>
              <p className="text-3xl font-bold text-white">{stats.pending_verifications}</p>
            </Card>
            <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
              <TrendingUp className="w-8 h-8 text-purple-400 mb-2" />
              <p className="text-white/60 text-sm">Verification Rate</p>
              <p className="text-3xl font-bold text-white">{stats.verification_rate}%</p>
            </Card>
          </div>
        )}

        {/* Pending Queue */}
        <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6">
            Pending Verifications ({pendingVerifications.length})
          </h2>

          {pendingVerifications.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
              <p className="text-white/80 text-lg">No pending verifications!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingVerifications.map((verification) => (
                <Card
                  key={verification.verification_id}
                  className="p-4 bg-white/5 border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                  onClick={() => setSelectedVerification(verification)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-semibold">{verification.user_info?.name}</h3>
                      <p className="text-white/60 text-sm">{verification.user_info?.email}</p>
                      <p className="text-white/40 text-xs mt-1 capitalize">
                        {verification.document_type.replace('_', ' ')} • Submitted{' '}
                        {new Date(verification.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button className="bg-blue-500 hover:bg-blue-600">
                      <Eye className="w-4 h-4 mr-2" />
                      Review
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
