/**
 * Card Game Particle Effects Overlay
 * Canvas-based particle system for sparkles, glows, and celebrations
 */

import { useEffect, useRef } from 'react';
import { useParticleSystem } from '@/utils/cardAnimations';

interface ParticleTrigger {
  x: number;
  y: number;
  color?: string;
  radius?: number;
}

interface ParticleEffectsOverlayProps {
  // Accept the structured trigger OR a numeric counter (used as a bump trigger in
  // legacy practice games) — only structured triggers actually spawn particles.
  triggerSparkle?: ParticleTrigger | number | null;
  triggerGlow?: ParticleTrigger | number | null;
  triggerCelebration?: boolean | null;
}

export default function ParticleEffectsOverlay({
  triggerSparkle,
  triggerGlow,
  triggerCelebration,
}: ParticleEffectsOverlayProps) {
  const { canvasRef, particleSystem } = useParticleSystem();
  const containerRef = useRef(null);

  // Resize canvas to match container
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        canvasRef.current.width = containerRef.current.offsetWidth;
        canvasRef.current.height = containerRef.current.offsetHeight;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, [canvasRef]);

  // Listen for particle triggers
  useEffect(() => {
    if (!particleSystem) return;

    if (triggerSparkle && typeof triggerSparkle === 'object') {
      const { x, y, color } = triggerSparkle;
      particleSystem.createSparkle(x, y, color);
    }
  }, [triggerSparkle, particleSystem]);

  useEffect(() => {
    if (!particleSystem) return;

    if (triggerGlow && typeof triggerGlow === 'object') {
      const { x, y, color, radius } = triggerGlow;
      particleSystem.createGlow(x, y, color, radius);
    }
  }, [triggerGlow, particleSystem]);

  useEffect(() => {
    if (!particleSystem || !triggerCelebration) return;

    // Create celebration burst
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Multiple bursts
    const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#ffe66d'];
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const angle = (Math.PI * 2 * i) / 8;
        const distance = 100;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        particleSystem.createSparkle(x, y, colors[i % colors.length]);
      }, i * 100);
    }
  }, [triggerCelebration, particleSystem, canvasRef]);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-50"
    >
      <canvas 
        ref={canvasRef}
        className="w-full h-full"
      />
    </div>
  );
}

/**
 * Confetti Celebration Component
 */
export function ConfettiCelebration({ active }: { active?: boolean }) {
  const canvasRef = useRef(null);
  const confettiRef = useRef([]);

  useEffect(() => {
    if (!active || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Create confetti pieces
    const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf', '#ff8b94'];
    for (let i = 0; i < 100; i++) {
      confettiRef.current.push({
        x: Math.random() * canvas.width,
        y: -20,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        size: Math.random() * 10 + 5,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    let animationId;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      confettiRef.current = confettiRef.current.filter(c => {
        c.x += c.vx;
        c.y += c.vy;
        c.vy += 0.1; // Gravity
        c.rotation += c.rotationSpeed;

        if (c.y > canvas.height + 20) return false;

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate((c.rotation * Math.PI) / 180);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size);
        ctx.restore();

        return true;
      });

      if (confettiRef.current.length > 0) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animate();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      confettiRef.current = [];
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas 
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
    />
  );
}
