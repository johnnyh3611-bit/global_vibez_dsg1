import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Store, CheckCircle, XCircle, Clock, TrendingUp, Users, Eye, MapPin } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminRestaurants() {
  const navigate = useNavigate();
  const [pending, setPending] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    status: 'approved',
    rejection_reason: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pendingRes, statsRes] = await Promise.all([
        fetch(`${API}/api/restaurants/admin/pending`, { }),
        fetch(`${API}/api/restaurants/admin/stats`, { })
      ]);

      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        setPending(pendingData.pending_restaurants || []);
      }

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
    if (!selectedRestaurant) return;

    try {
      const response = await fetch(`${API}/api/restaurants/admin/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          restaurant_id: selectedRestaurant.restaurant_id,
          status: reviewForm.status,
          rejection_reason: reviewForm.rejection_reason
        })
      });

      if (!response.ok) throw new Error('Failed to review restaurant');

      alert(`Restaurant ${reviewForm.status}!`);
      setSelectedRestaurant(null);
      setReviewForm({ status: 'approved', rejection_reason: '' });
      fetchData();
    } catch (err) {
      // console.error('Error reviewing restaurant:', err);
      alert('Failed to review restaurant');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Review Modal
  if (selectedRestaurant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-orange-900 to-red-900 p-6">
        <div className="max-w-6xl mx-auto">
          <Button
            onClick={() => setSelectedRestaurant(null)}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Queue
          </Button>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Restaurant Details */}
            <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
              <h3 className="text-2xl font-bold text-white mb-4">Restaurant Details</h3>
              
              {selectedRestaurant.cover_photo && (
                <img
                  src={selectedRestaurant.cover_photo}
                  alt={selectedRestaurant.name}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              )}

              <div className="space-y-3 text-white/90">
                <div>
                  <p className="text-sm text-white/60">Name</p>
                  <p className="font-bold text-lg">{selectedRestaurant.name}</p>
                </div>
                <div>
                  <p className="text-sm text-white/60">Address</p>
                  <p>{selectedRestaurant.address}, {selectedRestaurant.city}</p>
                </div>
                <div>
                  <p className="text-sm text-white/60">Submitter</p>
                  <p>{selectedRestaurant.submitter_info?.name} ({selectedRestaurant.submitter_info?.email})</p>
                  <p className="text-xs capitalize">{selectedRestaurant.submitter_type}</p>
                </div>
                <div>
                  <p className="text-sm text-white/60">Submitted</p>
                  <p>{new Date(selectedRestaurant.created_at).toLocaleString()}</p>
                </div>
                {selectedRestaurant.cuisine_type?.length > 0 && (
                  <div>
                    <p className="text-sm text-white/60 mb-1">Cuisine</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedRestaurant.cuisine_type.map((c, i) => (
                        <span key={`cuisine_type-${i}`} className="text-xs bg-orange-500 px-2 py-1 rounded">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Review Form */}
            <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
              <h3 className="text-2xl font-bold text-white mb-4">Review Submission</h3>

              <div className="mb-4">
                <label className="text-white font-semibold mb-2 block">Decision:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setReviewForm({ ...reviewForm, status: 'approved' })}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      reviewForm.status === 'approved'
                        ? 'border-green-400 bg-green-500/30'
                        : 'border-white/20 bg-white/5'
                    }`}
                  >
                    <CheckCircle className={`w-8 h-8 mx-auto mb-2 ${
                      reviewForm.status === 'approved' ? 'text-green-400' : 'text-white/40'
                    }`} />
                    <p className="text-white font-semibold">Approve</p>
                  </button>
                  <button
                    onClick={() => setReviewForm({ ...reviewForm, status: 'rejected' })}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      reviewForm.status === 'rejected'
                        ? 'border-red-400 bg-red-500/30'
                        : 'border-white/20 bg-white/5'
                    }`}
                  >
                    <XCircle className={`w-8 h-8 mx-auto mb-2 ${
                      reviewForm.status === 'rejected' ? 'text-red-400' : 'text-white/40'
                    }`} />
                    <p className="text-white font-semibold">Reject</p>
                  </button>
                </div>
              </div>

              {reviewForm.status === 'rejected' && (
                <div className="mb-4">
                  <label className="text-white font-semibold mb-2 block">Rejection Reason:</label>
                  <textarea
                    value={reviewForm.rejection_reason}
                    onChange={(e) => setReviewForm({ ...reviewForm, rejection_reason: e.target.value })}
                    placeholder="Explain why this restaurant was rejected..."
                    className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white h-24"
                    required
                  />
                </div>
              )}

              <Button
                onClick={handleReview}
                className={`w-full font-bold py-4 ${
                  reviewForm.status === 'approved'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                    : 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600'
                }`}
              >
                Submit {reviewForm.status === 'approved' ? 'Approval' : 'Rejection'}
              </Button>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Main Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-orange-900 to-red-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-4xl font-bold text-white">Restaurant Admin Dashboard</h1>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
              <Store className="w-8 h-8 text-orange-400 mb-2" />
              <p className="text-white/60 text-sm">Total Restaurants</p>
              <p className="text-3xl font-bold text-white">{stats.total_restaurants}</p>
            </Card>
            <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
              <CheckCircle className="w-8 h-8 text-green-400 mb-2" />
              <p className="text-white/60 text-sm">Approved</p>
              <p className="text-3xl font-bold text-white">{stats.approved_restaurants}</p>
            </Card>
            <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
              <Clock className="w-8 h-8 text-yellow-400 mb-2" />
              <p className="text-white/60 text-sm">Pending</p>
              <p className="text-3xl font-bold text-white">{stats.pending_restaurants}</p>
            </Card>
            <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
              <TrendingUp className="w-8 h-8 text-purple-400 mb-2" />
              <p className="text-white/60 text-sm">Total Reviews</p>
              <p className="text-3xl font-bold text-white">{stats.total_reviews}</p>
            </Card>
          </div>
        )}

        {/* Pending Queue */}
        <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6">
            Pending Submissions ({pending.length})
          </h2>

          {pending.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
              <p className="text-white/80 text-lg">No pending restaurants!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map((restaurant) => (
                <Card
                  key={restaurant.restaurant_id}
                  className="p-4 bg-white/5 border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                  onClick={() => setSelectedRestaurant(restaurant)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      {restaurant.cover_photo && (
                        <img
                          src={restaurant.cover_photo}
                          alt={restaurant.name}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                      )}
                      <div>
                        <h3 className="text-white font-bold text-lg">{restaurant.name}</h3>
                        <div className="flex items-center gap-2 text-white/60 text-sm mt-1">
                          <MapPin className="w-4 h-4" />
                          <span>{restaurant.city}</span>
                        </div>
                        <p className="text-white/40 text-xs mt-1 capitalize">
                          By {restaurant.submitter_type} • {new Date(restaurant.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button className="bg-orange-500 hover:bg-orange-600">
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