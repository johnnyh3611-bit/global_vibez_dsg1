import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function PaymentCancel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rideId = searchParams.get('ride_id');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="bg-slate-800/50 border-slate-700 p-8 max-w-md w-full text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mb-6"
          >
            <XCircle className="w-24 h-24 text-orange-500 mx-auto" />
          </motion.div>
          
          <h1 className="text-3xl font-bold text-white mb-4">
            Payment Cancelled
          </h1>
          
          <p className="text-gray-300 mb-6">
            Your payment was cancelled. No charges were made to your account.
          </p>

          <div className="space-y-3">
            <Button
              onClick={() => navigate('/vibe-ridez/search')}
              className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back to Search
            </Button>
            
            <Button
              variant="outline"
              onClick={() => navigate('/vibe-ridez')}
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Go to Home
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
