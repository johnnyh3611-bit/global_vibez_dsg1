import React from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle, ArrowLeft, HelpCircle } from 'lucide-react';

const EntryFeeCancel = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-orange-900 to-black flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Icon */}
        <div className="text-center mb-8">
          <XCircle className="w-24 h-24 text-orange-400 mx-auto mb-4" />
          <h1 className="text-4xl font-black text-white mb-2">Payment Cancelled</h1>
          <p className="text-gray-400">Your payment was not completed</p>
        </div>

        {/* Info Card */}
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl border border-orange-500/30 rounded-2xl p-8 shadow-2xl mb-6">
          <p className="text-gray-300 text-center mb-6">
            No charges were made. You can try again whenever you're ready.
          </p>

          <div className="bg-black/40 rounded-lg p-4 mb-6">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-cyan-400" />
              Need Assistance?
            </h3>
            <ul className="text-gray-400 text-sm space-y-2">
              <li>• Payment questions? Contact support@globalvibez.com</li>
              <li>• Still have trial time? Continue exploring!</li>
              <li>• Secure payment powered by Stripe</li>
            </ul>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/entry-fee')}
              className="w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 text-white font-bold text-lg py-4 rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-cyan-500/50"
            >
              Try Again
            </button>

            <button
              onClick={() => navigate('/games')}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Support Info */}
        <div className="text-center">
          <p className="text-gray-500 text-xs">
            Having issues? We're here to help 24/7
          </p>
        </div>
      </div>
    </div>
  );
};

export default EntryFeeCancel;
