import { motion } from 'framer-motion';

const NUM_PARTICLES = 40;
const PARTICLE_COLORS = ['#FFD700', '#FFA500', '#00CED1', '#FF1493'];

export const FloatingParticlesLayer = ({ width, height }) => (
  <>
    {Array.from({ length: NUM_PARTICLES }).map((_, i) => {
      const size = 4 + Math.random() * 8;
      const color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
      const glowSize = 10 + Math.random() * 20;
      return (
        <motion.div
          key={`particle-${i}`}
          initial={{ x: width / 2, y: height + 100, opacity: 0, scale: 0 }}
          animate={{
            x: width / 2 + (Math.random() - 0.5) * width * 1.5,
            y: -100,
            opacity: [0, 0.8, 0.8, 0],
            scale: [0, 1, 1, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            delay: i * 0.05,
            ease: 'easeOut',
          }}
          className="absolute rounded-full"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            background: color,
            boxShadow: `0 0 ${glowSize}px currentColor`,
            filter: 'blur(1px)',
          }}
        />
      );
    })}
  </>
);

export default FloatingParticlesLayer;
