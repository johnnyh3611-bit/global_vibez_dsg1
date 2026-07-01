import React from 'react';
import { motion } from 'framer-motion';
import LoadingSpinner from './LoadingSpinner';

const PageLoader = ({ message = 'Loading...' }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl mx-auto mb-4">
            <span className="text-white font-black text-3xl">GV</span>
          </div>
          <h2 className="text-2xl font-black text-transparent bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text">
            Global Vibez DSG
          </h2>
        </div>
        <LoadingSpinner size="lg" text={message} />
      </motion.div>
    </div>
  );
};

export default PageLoader;
