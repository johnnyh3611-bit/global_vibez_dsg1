/**
 * Advanced Card Animation Utilities
 * Provides "juice" for card games - physics, particles, and visual effects
 */

import { useRef, useEffect } from 'react';

/**
 * Card Physics - Parabolic arc animation from point A to point B
 */
export const useCardArcAnimation = (duration = 0.5) => {
  return {
    initial: { x: 0, y: 0, opacity: 0, rotate: -20, scale: 0.8 },
    animate: { 
      x: 0, 
      y: 0, 
      opacity: 1, 
      rotate: 0,
      scale: 1,
      transition: {
        duration,
        ease: [0.34, 1.56, 0.64, 1], // Custom ease for card "snap"
        y: {
          type: "spring",
          stiffness: 100,
          damping: 12
        }
      }
    },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
  };
};

/**
 * Card Bend Physics - Subtle flex on pickup/play
 */
export const useCardBendAnimation = (isHovered) => {
  return {
    transform: isHovered 
      ? 'perspective(1000px) rotateY(-5deg) rotateX(2deg)' 
      : 'perspective(1000px) rotateY(0deg) rotateX(0deg)',
    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
  };
};

/**
 * Slow Motion Highlight Animation
 */
export const slowMotionHighlight = {
  initial: { scale: 1, opacity: 1 },
  animate: {
    scale: [1, 1.15, 1.1],
    opacity: [1, 1, 1],
    transition: {
      duration: 1.5,
      times: [0, 0.5, 1],
      ease: "easeInOut"
    }
  }
};

/**
 * Particle System - Sparkles and glow effects
 */
export class CardParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d');
    this.particles = [];
    this.animationId = null;
  }

  createSparkle(x, y, color = '#ffd700') {
    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 2,
        life: 1,
        decay: 0.015,
        size: Math.random() * 3 + 1,
        color
      });
    }

    if (!this.animationId) {
      this.animate();
    }
  }

  createGlow(x, y, color = '#ffd700', radius = 50) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 1,
      decay: 0.02,
      size: radius,
      color,
      type: 'glow'
    });

    if (!this.animationId) {
      this.animate();
    }
  }

  animate() {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // Gravity
      p.life -= p.decay;

      if (p.life <= 0) return false;

      if (p.type === 'glow') {
        // Radial gradient glow
        const gradient = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        gradient.addColorStop(0, `${p.color}${Math.floor(p.life * 100).toString(16).padStart(2, '0')}`);
        gradient.addColorStop(1, `${p.color}00`);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      } else {
        // Sparkle
        this.ctx.fillStyle = `${p.color}${Math.floor(p.life * 255).toString(16).padStart(2, '0')}`;
        this.ctx.fillRect(p.x, p.y, p.size, p.size);
      }

      return true;
    });

    if (this.particles.length > 0) {
      this.animationId = requestAnimationFrame(() => this.animate());
    } else {
      this.animationId = null;
    }
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.particles = [];
  }
}

/**
 * Hook: Use Particle System
 */
export const useParticleSystem = () => {
  const canvasRef = useRef(null);
  const particleSystemRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && !particleSystemRef.current) {
      particleSystemRef.current = new CardParticleSystem(canvasRef.current);
    }

    return () => {
      particleSystemRef.current?.destroy();
    };
  }, []);

  return { canvasRef, particleSystem: particleSystemRef.current };
};

/**
 * Motion Blur Effect (CSS-based)
 */
export const motionBlurStyles = (isMoving) => ({
  filter: isMoving ? 'blur(2px)' : 'blur(0px)',
  transition: 'filter 0.1s ease-out'
});

/**
 * Card Glow Effect
 */
export const cardGlowStyles = (isActive, color = '#ffd700') => ({
  boxShadow: isActive 
    ? `0 0 20px ${color}, 0 0 40px ${color}80, 0 0 60px ${color}40`
    : '0 4px 20px rgba(0,0,0,0.3)',
  transition: 'box-shadow 0.3s ease-in-out'
});

/**
 * Chip Stack Animation
 */
export const chipStackAnimation = {
  initial: { scale: 0, y: -50 },
  animate: { 
    scale: 1, 
    y: 0,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 15
    }
  }
};

/**
 * Smooth Card Sorting Animation
 */
export const cardSortAnimation = (index) => ({
  initial: { x: 0, opacity: 0.5 },
  animate: { 
    x: 0, 
    opacity: 1,
    transition: {
      delay: index * 0.05,
      duration: 0.3,
      ease: "easeOut"
    }
  }
});

/**
 * Table Reflection Effect (for card shadows)
 */
export const tableReflectionStyles = {
  position: 'absolute',
  bottom: '-10px',
  left: '0',
  width: '100%',
  height: '10px',
  background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), transparent)',
  filter: 'blur(4px)',
  opacity: 0.6,
  transform: 'scaleY(-1)',
  pointerEvents: 'none'
};

/**
 * Winning Hand Celebration Animation
 */
export const winningHandAnimation = {
  animate: {
    scale: [1, 1.1, 1.05],
    rotate: [0, -5, 5, -3, 3, 0],
    transition: {
      duration: 0.8,
      times: [0, 0.3, 1],
      repeat: 2
    }
  }
};

/**
 * Card Deal Sequence - Staggered animations
 */
export const dealSequence = (index, totalCards) => ({
  initial: { 
    x: 0, 
    y: -200, 
    opacity: 0, 
    rotate: -180 
  },
  animate: { 
    x: 0, 
    y: 0, 
    opacity: 1, 
    rotate: index * 2 - totalCards, // Fan effect
    transition: {
      delay: index * 0.1,
      duration: 0.4,
      ease: [0.34, 1.56, 0.64, 1]
    }
  }
});

export default {
  useCardArcAnimation,
  useCardBendAnimation,
  slowMotionHighlight,
  useParticleSystem,
  motionBlurStyles,
  cardGlowStyles,
  chipStackAnimation,
  cardSortAnimation,
  tableReflectionStyles,
  winningHandAnimation,
  dealSequence
};
