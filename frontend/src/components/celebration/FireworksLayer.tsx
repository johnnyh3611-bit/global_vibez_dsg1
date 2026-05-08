import React from 'react';
import { motion } from 'framer-motion';

const FIREWORK_COLORS = ['#FFD700', '#FF1493', '#00CED1', '#FF6347', '#32CD32', '#FFA500'];
const NUM_FIREWORKS = 8;
const PARTICLES_PER_FIREWORK = 20;

const Rocket = ({ launchX, launchDelay, explodeHeight, color }) => (
  <motion.div
    initial={{ x: `${launchX}%`, y: '100%', opacity: 0 }}
    animate={{ x: `${launchX}%`, y: `${explodeHeight}%`, opacity: [0, 1, 1, 0] }}
    transition={{
      duration: 1.2,
      delay: launchDelay,
      repeat: Infinity,
      repeatDelay: 2,
      ease: 'easeOut',
    }}
    className="absolute w-2 h-8 rounded-full"
    style={{
      background: `linear-gradient(180deg, ${color}, transparent)`,
      boxShadow: `0 0 20px ${color}`,
    }}
  />
);

const Particle = ({ fireworkIdx, particleIdx, launchX, launchDelay, explodeHeight, color }) => {
  const angle = (particleIdx / PARTICLES_PER_FIREWORK) * Math.PI * 2;
  const distance = 80 + Math.random() * 60;
  const endX = Math.cos(angle) * distance;
  const endY = Math.sin(angle) * distance;
  return (
    <motion.div
      key={`p-${fireworkIdx}-${particleIdx}`}
      initial={{ x: `${launchX}%`, y: `${explodeHeight}%`, scale: 0, opacity: 0 }}
      animate={{
        x: `calc(${launchX}% + ${endX}px)`,
        y: `calc(${explodeHeight}% + ${endY}px)`,
        scale: [0, 1, 0.5],
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        duration: 1.5,
        delay: launchDelay + 1.2,
        repeat: Infinity,
        repeatDelay: 2,
        ease: 'easeOut',
      }}
      className="absolute w-2 h-2 rounded-full"
      style={{ background: color, boxShadow: `0 0 15px ${color}` }}
    />
  );
};

const ExplosionFlash = ({ launchX, launchDelay, explodeHeight, color }) => (
  <motion.div
    initial={{ x: `${launchX}%`, y: `${explodeHeight}%`, scale: 0, opacity: 0 }}
    animate={{ scale: [0, 3, 0], opacity: [0, 0.8, 0] }}
    transition={{ duration: 0.5, delay: launchDelay + 1.2, repeat: Infinity, repeatDelay: 2 }}
    className="absolute w-20 h-20 rounded-full"
    style={{
      background: `radial-gradient(circle, ${color}, transparent)`,
      filter: 'blur(10px)',
    }}
  />
);

export const FireworksLayer = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {Array.from({ length: NUM_FIREWORKS }).map((_, i) => {
      const launchX = 15 + i * 12;
      const launchDelay = i * 0.4;
      const explodeHeight = 20 + Math.random() * 30;
      const color = FIREWORK_COLORS[i % FIREWORK_COLORS.length];
      return (
        <React.Fragment key={`firework-${i}`}>
          <Rocket launchX={launchX} launchDelay={launchDelay} explodeHeight={explodeHeight} color={color} />
          {Array.from({ length: PARTICLES_PER_FIREWORK }).map((__, pi) => (
            <Particle
              key={`fw-${i}-p-${pi}`}
              fireworkIdx={i}
              particleIdx={pi}
              launchX={launchX}
              launchDelay={launchDelay}
              explodeHeight={explodeHeight}
              color={color}
            />
          ))}
          <ExplosionFlash
            launchX={launchX}
            launchDelay={launchDelay}
            explodeHeight={explodeHeight}
            color={color}
          />
        </React.Fragment>
      );
    })}
  </div>
);

export default FireworksLayer;
