
/**
 * RouletteStats - Hot/Cold numbers, recent spins history
 * Displays analytics and patterns
 */
import React from 'react';
import { motion } from 'framer-motion';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

const getNumberColor = (num: number): 'green' | 'red' | 'black' => {
  if (num === 0) return 'green';
  return RED_NUMBERS.includes(num) ? 'red' : 'black';
};

const RouletteStats = ({ recentNumbers }: { recentNumbers: number[] }) => {
  // Calculate hot/cold numbers
  const numberFrequency = recentNumbers.reduce<Record<number, number>>((acc, num) => {
    acc[num] = (acc[num] || 0) + 1;
    return acc;
  }, {});

  const sortedByFrequency = (Object.entries(numberFrequency) as Array<[string, number]>)
    .sort(([, a], [, b]) => b - a);

  const hotNumbers = sortedByFrequency.slice(0, 5);
  const coldNumbers = sortedByFrequency.slice(-5).reverse();

  // Calculate color distribution
  const colorStats = recentNumbers.reduce<Record<string, number>>((acc, num) => {
    const color = getNumberColor(num);
    acc[color] = (acc[color] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Recent Numbers */}
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <p className="text-amber-300 text-sm font-bold">Recent Spins</p>
          <span className="text-white/60 text-xs">{recentNumbers.length} spins</span>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {recentNumbers.slice(0, 15).map((num) => {
            const color = getNumberColor(num);
            const bgColor = color === 'green' ? 'bg-emerald-600' : color === 'red' ? 'bg-red-600' : 'bg-gray-800';
            
            return (
              <motion.div
                key={`recent-${num}-${Math.random()}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: recentNumbers.indexOf(num) * 0.05 }}
                className={`${bgColor} w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm border border-white/20 shadow-lg`}
              >
                {num}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Hot Numbers */}
      {hotNumbers.length > 0 && (
        <div className="bg-gradient-to-br from-orange-900/40 to-red-900/40 backdrop-blur-xl rounded-2xl p-4 border border-orange-500/30">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🔥</span>
            <p className="text-orange-300 text-sm font-bold">Hot Numbers</p>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {hotNumbers.map(([num, count]) => {
              const color = getNumberColor(parseInt(num));
              const bgColor = color === 'green' ? 'bg-emerald-600' : color === 'red' ? 'bg-red-600' : 'bg-gray-800';
              
              return (
                <div key={num} className="relative">
                  <div className={`${bgColor} w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold border border-white/20 shadow-lg`}>
                    {num}
                  </div>
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cold Numbers */}
      {coldNumbers.length > 0 && (
        <div className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 backdrop-blur-xl rounded-2xl p-4 border border-cyan-500/30">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">❄️</span>
            <p className="text-cyan-300 text-sm font-bold">Cold Numbers</p>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {coldNumbers.map(([num, count]) => {
              const color = getNumberColor(parseInt(num));
              const bgColor = color === 'green' ? 'bg-emerald-600' : color === 'red' ? 'bg-red-600' : 'bg-gray-800';
              
              return (
                <div key={num} className="relative">
                  <div className={`${bgColor} w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold border border-white/20 shadow-lg opacity-60`}>
                    {num}
                  </div>
                  <span className="absolute -top-1 -right-1 bg-cyan-500 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Color Distribution */}
      {Object.keys(colorStats).length > 0 && (
        <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
          <p className="text-amber-300 text-sm font-bold mb-3">Color Distribution</p>
          
          <div className="space-y-2">
            {Object.entries(colorStats).map(([color, count]) => {
              const percentage = ((count / recentNumbers.length) * 100).toFixed(1);
              const barColor = color === 'green' ? 'bg-emerald-500' : color === 'red' ? 'bg-red-500' : 'bg-gray-700';
              
              return (
                <div key={color}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/80 text-xs font-bold capitalize">{color}</span>
                    <span className="text-white/60 text-xs">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      className={`${barColor} h-2 rounded-full`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Data State */}
      {recentNumbers.length === 0 && (
        <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-8 border border-white/10 text-center">
          <p className="text-white/60 text-sm">No spins yet. Place a bet and spin to start!</p>
        </div>
      )}
    </div>
  );
};

export default RouletteStats;
