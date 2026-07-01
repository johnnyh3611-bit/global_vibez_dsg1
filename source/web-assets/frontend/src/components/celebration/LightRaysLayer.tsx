import { motion } from 'framer-motion';

const NUM_RAYS = 8;

export const LightRaysLayer = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {Array.from({ length: NUM_RAYS }).map((_, i) => (
      <motion.div
        key={`ray-${i}`}
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: [0, 0.3, 0], scaleY: [0, 1, 1] }}
        transition={{
          duration: 2,
          delay: i * 0.2,
          repeat: Infinity,
          repeatDelay: 1,
        }}
        className="absolute top-0 w-32 h-full"
        style={{
          left: `${i * 12.5}%`,
          background: 'linear-gradient(180deg, rgba(255, 215, 0, 0.4) 0%, transparent 60%)',
          transform: 'skewX(-10deg)',
          filter: 'blur(30px)',
        }}
      />
    ))}
  </div>
);

export default LightRaysLayer;
