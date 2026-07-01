import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';

export default function PaymentCancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center bg-white">
        <XCircle className="w-16 h-16 mx-auto mb-4 text-orange-500" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Cancelled</h2>
        <p className="text-gray-600 mb-6">
          Your payment was cancelled. No charges were made to your account.
        </p>
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/upgrade')}
            className="flex-1"
            data-testid="try-again-btn"
          >
            Try Again
          </Button>
          <Button
            onClick={() => navigate('/dashboard')}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            data-testid="go-to-dashboard-btn"
          >
            Go to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}