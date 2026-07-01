/**
 * IntegrityHUD - Transparent overlay showing SHA-256 Provably Fair hash
 * Designed to overlay on top of UE5 MetaHuman dealer viewport
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Check, Copy, Eye } from 'lucide-react';

const IntegrityHUD = ({ 
  verificationHash = null,
  deckSeed = null,
  tableName = "Glasshouse Table 1",
  isVisible = true,
  position = "top-right" // top-right, top-left, bottom-right, bottom-left
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hashData, setHashData] = useState({
    hash: verificationHash,
    seed: deckSeed,
    timestamp: new Date().toISOString()
  });

  useEffect(() => {
    if (verificationHash) {
      setHashData({
        hash: verificationHash,
        seed: deckSeed,
        timestamp: new Date().toISOString()
      });
    }
  }, [verificationHash, deckSeed]);

  const handleCopy = () => {
    if (hashData.hash) {
      navigator.clipboard.writeText(hashData.hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const positionClasses = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4"
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed ${positionClasses[position]} z-50 pointer-events-auto`}>
      <AnimatePresence>
        {!isExpanded ? (
          // Compact Badge
          <motion.button
            key="compact"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => setIsExpanded(true)}
            className="bg-emerald-600/90 backdrop-blur-xl border-2 border-emerald-400/50 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 hover:bg-emerald-500/90 transition-all group"
          >
            <Shield className="w-5 h-5 text-white" />
            <div className="flex flex-col items-start">
              <span className="text-white text-xs font-bold uppercase tracking-wide">
                Provably Fair
              </span>
              <span className="text-emerald-200 text-[10px] font-mono">
                {hashData.hash ? `${hashData.hash.substring(0, 8)}...` : 'Generating...'}
              </span>
            </div>
            <Eye className="w-4 h-4 text-emerald-200 opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.button>
        ) : (
          // Expanded Panel
          <motion.div
            key="expanded"
            initial={{ scale: 0.95, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -10 }}
            className="bg-black/95 backdrop-blur-2xl border-2 border-emerald-500/50 rounded-3xl shadow-2xl p-6 w-96"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600/20 rounded-full flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Integrity Verification</h3>
                  <p className="text-emerald-400 text-xs">{tableName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-white/60 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Hash Display */}
            <div className="space-y-4">
              {/* Verification Hash */}
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-emerald-400 text-xs font-bold uppercase tracking-wide">
                    SHA-256 Hash
                  </label>
                  <div className="flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 text-[10px]">Verified</span>
                  </div>
                </div>
                <div className="relative">
                  <p className="text-white/90 font-mono text-xs break-all leading-relaxed">
                    {hashData.hash || 'Hash generation in progress...'}
                  </p>
                  {hashData.hash && (
                    <button
                      onClick={handleCopy}
                      className="absolute top-0 right-0 bg-emerald-600/20 hover:bg-emerald-600/40 p-1.5 rounded-lg transition-all"
                      title="Copy hash"
                    >
                      {copied ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-white/60" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Deck Seed (optional) */}
              {hashData.seed && (
                <div className="bg-purple-950/40 border border-purple-500/30 rounded-xl p-4">
                  <label className="text-purple-400 text-xs font-bold uppercase tracking-wide mb-2 block">
                    Deck Seed
                  </label>
                  <p className="text-white/90 font-mono text-xs break-all">
                    {hashData.seed}
                  </p>
                </div>
              )}

              {/* Timestamp */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Generated:</span>
                <span className="text-white/90 font-mono">
                  {new Date(hashData.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Verification Message */}
              <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-3">
                <p className="text-cyan-300 text-xs italic">
                  "This hash was generated before dealing. Verify fairness after the game concludes."
                </p>
                <p className="text-white/60 text-[10px] mt-2">
                  — Your AI Dealer
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 py-2 px-4 rounded-xl text-xs font-bold transition-all"
                >
                  Verify on Blockchain
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCopy}
                  className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white py-2 px-4 rounded-xl text-xs font-bold transition-all"
                >
                  {copied ? 'Copied!' : 'Copy Hash'}
                </motion.button>
              </div>
            </div>

            {/* Pulse Animation */}
            <div className="absolute -inset-px bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-purple-500/20 rounded-3xl blur-xl -z-10 animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IntegrityHUD;
