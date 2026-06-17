import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import LiveRideTracking from '@/components/vibe-ridez/LiveRideTracking';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rideId = searchParams.get('ride_id');
  const sessionId = searchParams.get('session_id');
  
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rideDetails, setRideDetails] = useState(null);
  const [showTracking, setShowTracking] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    try {
      // Get current user
      const userResponse = await fetch(`${API_URL}/api/auth/me`, {
      });
      const userData = await userResponse.json();
      setUserId(userData.user_id);

      // Verify payment status
      if (sessionId) {
        const response = await fetch(`${API_URL}/api/vibe-ridez/payment/status/${sessionId}`, {
        });
        const data = await response.json();
        
        if (data.success && data.payment_status === 'complete') {
          setPaymentVerified(true);
          
          // Get ride details
          const rideResponse = await fetch(`${API_URL}/api/vibe-ridez/ride/${rideId}`, {
          });
          const rideData = await rideResponse.json();
          setRideDetails(rideData.ride);
        }
      }
    } catch (error) {
      // console.error('Payment verification error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTracking = () => {
    setShowTracking(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Verifying payment...</div>
      </div>
    );
  }

  if (showTracking && rideDetails && userId) {
    return (
      <LiveRideTracking
        rideId={rideId}
        userId={userId}
        role="passenger"
        pickupLocation={rideDetails.pickup_location}
        dropoffLocation={rideDetails.dropoff_location}
        onClose={() => setShowTracking(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="bg-slate-800/50 border-slate-700 p-8 max-w-md w-full text-center">
          {paymentVerified ? (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="mb-6"
              >
                <CheckCircle className="w-24 h-24 text-green-500 mx-auto" />
              </motion.div>
              
              <h1 className="text-3xl font-bold text-white mb-4">
                Payment Successful! 🎉
              </h1>
              
              <p className="text-gray-300 mb-6">
                Your ride has been booked successfully. You can now track your ride in real-time.
              </p>

              {rideDetails && (
                <div className="bg-slate-900/50 rounded-lg p-4 mb-6 text-left">
                  <div className="space-y-2 text-sm text-gray-300">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-green-400" />
                      <span className="font-semibold">From:</span>
                      <span>{rideDetails.pickup_location?.city}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-red-400" />
                      <span className="font-semibold">To:</span>
                      <span>{rideDetails.dropoff_location?.city}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Button
                  onClick={handleStartTracking}
                  className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
                >
                  <MapPin className="mr-2 h-5 w-5" />
                  Track Your Ride
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => navigate('/vibe-ridez')}
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Back to Home
                </Button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white mb-4">
                Payment Verification Failed
              </h1>
              <p className="text-gray-400 mb-6">
                We couldn't verify your payment. Please contact support if you were charged.
              </p>
              <Button
                onClick={() => navigate('/vibe-ridez/search')}
                className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
              >
                Back to Search
              </Button>
            </>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
