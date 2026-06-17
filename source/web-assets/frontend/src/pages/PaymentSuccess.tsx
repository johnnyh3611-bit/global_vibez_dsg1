import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, Crown } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('checking'); // 'checking', 'success', 'error'
  const [message, setMessage] = useState('Verifying your payment...');
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setMessage('No payment session found');
      return;
    }

    pollPaymentStatus(sessionId, 0);
  }, [sessionId]);

  const pollPaymentStatus = async (sessionId, attempts) => {
    const maxAttempts = 5;
    const pollInterval = 2000; // 2 seconds

    if (attempts >= maxAttempts) {
      setStatus('error');
      setMessage('Payment verification timed out. Please check your account or contact support.');
      return;
    }

    try {
      const response = await fetch(`${API}/payment/status/${sessionId}`, {
      });

      if (!response.ok) {
        throw new Error('Failed to check payment status');
      }

      const data = await response.json();

      if (data.payment_status === 'paid') {
        setStatus('success');
        setMessage('Payment successful! You are now a Premium member.');
        return;
      } else if (data.status === 'expired') {
        setStatus('error');
        setMessage('Payment session expired. Please try again.');
        return;
      }

      // If payment is still pending, continue polling
      setMessage('Payment is being processed...');
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), pollInterval);
    } catch (error) {
      // console.error('Error checking payment status:', error);
      setStatus('error');
      setMessage('Error verifying payment. Please contact support.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center bg-white">
        {status === 'checking' && (
          <>
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-purple-600 animate-spin" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Processing Payment</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="relative mb-4">
              <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
              <Crown className="w-8 h-8 absolute top-0 right-1/3 text-yellow-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Premium! 🎉</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <p className="text-purple-800 font-semibold">You now have access to:</p>
              <ul className="text-left text-purple-700 mt-2 space-y-1 text-sm">
                <li>✨ Unlimited swipes</li>
                <li>✨ Real-time translation</li>
                <li>✨ Unlimited speed dating</li>
                <li>✨ All premium features!</li>
              </ul>
            </div>
            <Button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
              data-testid="go-to-dashboard-btn"
            >
              Go to Dashboard
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Issue</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => navigate('/upgrade')}
                className="flex-1"
              >
                Try Again
              </Button>
              <Button
                onClick={() => navigate('/dashboard')}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              >
                Go to Dashboard
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}