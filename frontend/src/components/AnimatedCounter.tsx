import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';

export function AnimatedCounter({ value, duration = 1 }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));

  useEffect(() => {
    const controls = animate(count, value, { duration });
    return controls.stop;
  }, [count, value, duration]);

  return <motion.span>{rounded}</motion.span>;
}

export function VibeScoreDisplay({ score, rank, label = "Vibe Score" }) {
  return (
    <div className="relative">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="backdrop-blur-xl bg-gradient-to-br from-fuchsia-600/20 to-pink-600/20 border-2 border-fuchsia-400/40 rounded-2xl p-4"
      >
        {/* Glow effect */}
        <motion.div
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.05, 1]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/30 to-pink-500/30 rounded-2xl blur-xl"
        />

        <div className="relative z-10">
          <div className="text-white/70 text-sm mb-1">{label}</div>
          <div className="flex items-baseline gap-2">
            <motion.div
              className="text-4xl font-black text-white"
              whileHover={{ scale: 1.1 }}
            >
              <AnimatedCounter value={score} duration={1.5} />
            </motion.div>
            {rank && (
              <motion.div
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-fuchsia-300 text-sm font-bold"
              >
                #{rank}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function ProgressBarAnimated({ progress, label, color = 'fuchsia' }) {
  const colorMap = {
    fuchsia: 'from-fuchsia-500 to-pink-500',
    cyan: 'from-cyan-500 to-blue-500',
    green: 'from-green-500 to-emerald-500',
    yellow: 'from-yellow-500 to-orange-500'
  };

  return (
    <div>
      {label && (
        <div className="flex justify-between text-sm text-white/70 mb-2">
          <span>{label}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      )}
      <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden backdrop-blur-xl border border-white/20">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ 
            duration: 1.5, 
            ease: 'easeOut',
            delay: 0.3
          }}
          className={`h-full bg-gradient-to-r ${colorMap[color]} shadow-[0_0_20px_rgba(232,121,249,0.6)]`}
        />
      </div>
    </div>
  );
}
