import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export function BigWinCelebration({ isOpen, onClose, reward }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animationFrameRef = useRef(null);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowContent(true);
      initCanvas();
      initParticles();
      animate();
      
      // Play sound effect (optional - add sound file)
      // const winSound = new Audio('/sounds/big-win.mp3');
      // winSound.play().catch(() => {});
    } else {
      particlesRef.current = [];
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setShowContent(false);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isOpen]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  };

  const createParticle = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    return {
      x: canvas.width / 2,
      y: canvas.height / 2,
      size: Math.random() * 15 + 5,
      speedX: (Math.random() - 0.5) * 15,
      speedY: (Math.random() - 0.5) * 15,
      color: `hsl(${Math.random() * 360}, 70%, 60%)`,
      rotation: Math.random() * 360,
      spin: (Math.random() - 0.5) * 10,
      alpha: 1
    };
  };

  const initParticles = () => {
    particlesRef.current = [];
    // Fewer particles on mobile for performance
    const particleCount = window.innerWidth < 768 ? 50 : 100;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = createParticle();
      if (particle) particlesRef.current.push(particle);
    }
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particlesRef.current.forEach((p, index) => {
      p.x += p.speedX;
      p.y += p.speedY;
      p.speedY += 0.1; // Gravity
      p.rotation += p.spin;
      p.alpha -= 0.005; // Fade out

      if (p.alpha > 0 && p.y < canvas.height + 100) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        
        // Draw 3D-looking cube
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else {
        particlesRef.current.splice(index, 1);
      }
    });

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const handleClaim = () => {
    if (reward?.onClaim) {
      reward.onClaim();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] overflow-hidden"
        style={{
          background: 'radial-gradient(circle, rgba(0,255,180,0.2) 0%, rgba(0,0,0,0.85) 100%)'
        }}
      >
        {/* Rotating Light Rays */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          className="absolute w-[200%] h-[200%] -top-1/2 -left-1/2"
          style={{
            background: 'conic-gradient(from 0deg, transparent, rgba(255,255,255,0.1), transparent 10%)',
            pointerEvents: 'none'
          }}
        />

        {/* Particle Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ pointerEvents: 'none' }}
        />

        {/* Win Content */}
        <div className="relative z-10 flex items-center justify-center h-full">
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 100 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ 
              type: 'spring', 
              stiffness: 200, 
              damping: 20,
              delay: 0.2 
            }}
            className="text-center px-4"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              <X size={32} />
            </button>

            {/* Main Title */}
            <motion.h1
              animate={{
                textShadow: [
                  '0 0 20px rgba(255, 218, 98, 0.8), 0 0 50px rgba(255, 165, 0, 0.5)',
                  '0 0 30px rgba(255, 218, 98, 1), 0 0 60px rgba(255, 165, 0, 0.8)',
                  '0 0 20px rgba(255, 218, 98, 0.8), 0 0 50px rgba(255, 165, 0, 0.5)'
                ]
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-6xl md:text-8xl font-black text-[#ffda62] mb-4"
              style={{
                transform: 'perspective(500px) rotateX(10deg)',
                filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}
            >
              {reward?.title || 'BIG WIN!'}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-2xl md:text-3xl font-bold text-fuchsia-300 mb-6"
              style={{
                textShadow: '0 0 10px rgba(232,121,249,0.8)'
              }}
            >
              {reward?.subtitle || 'CARD SHARK BONUS'}
            </motion.p>

            {/* Coin Count */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ delay: 0.6, type: 'spring', stiffness: 200 }}
              className="text-5xl md:text-7xl font-black text-white mb-8"
              style={{
                fontFamily: "'Orbitron', 'Courier New', monospace",
                textShadow: '0 0 20px #00ffb4, 0 0 40px #00ffb4'
              }}
            >
              +{reward?.coins?.toLocaleString() || '1,500'} COINS
            </motion.div>

            {/* Dollar Value */}
            {reward?.coins && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-2xl font-bold text-green-400 mb-8"
              >
                ≈ ${(reward.coins / 2000).toFixed(2)}
              </motion.div>
            )}

            {/* Claim Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleClaim}
              className="px-12 py-5 bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 text-black font-black text-2xl rounded-2xl shadow-[0_0_40px_rgba(234,179,8,0.8)] hover:shadow-[0_0_60px_rgba(234,179,8,1)] transition-all"
              style={{
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s infinite'
              }}
            >
              CLAIM REWARD
            </motion.button>

            {/* Additional Info */}
            {reward?.extraInfo && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="mt-6 text-white/60 text-sm"
              >
                {reward.extraInfo}
              </motion.p>
            )}
          </motion.div>
        </div>

        {/* Shimmer Animation */}
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
}
