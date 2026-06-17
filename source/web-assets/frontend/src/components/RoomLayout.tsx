import { motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { Stars, Float } from '@react-three/drei';

const roomThemes = {
  dating: {
    gradient: 'from-pink-600 via-rose-500 to-purple-600',
    glow: 'shadow-[0_0_30px_rgba(225,29,72,0.5)]',
    primary: '#E11D48',
    bgColor: '#1a0515'
  },
  games: {
    gradient: 'from-cyan-500 via-blue-500 to-indigo-600',
    glow: 'shadow-[0_0_30px_rgba(14,165,233,0.5)]',
    primary: '#0EA5E9',
    bgColor: '#020617'
  },
  tournaments: {
    gradient: 'from-amber-400 via-orange-500 to-purple-700',
    glow: 'shadow-[0_0_30px_rgba(245,158,11,0.5)]',
    primary: '#F59E0B',
    bgColor: '#1a0f02'
  },
  social: {
    gradient: 'from-orange-500 via-pink-500 to-rose-500',
    glow: 'shadow-[0_0_30px_rgba(249,115,22,0.5)]',
    primary: '#F97316',
    bgColor: '#1a0a02'
  },
  rides: {
    gradient: 'from-blue-600 via-sky-500 to-cyan-400',
    glow: 'shadow-[0_0_30px_rgba(59,130,246,0.5)]',
    primary: '#3B82F6',
    bgColor: '#020a1a'
  },
  premium: {
    gradient: 'from-yellow-400 via-amber-200 to-yellow-600',
    glow: 'shadow-[0_0_30px_rgba(255,215,0,0.6)]',
    primary: '#FFD700',
    bgColor: '#1a1502'
  }
};

export const RoomLayout = ({ theme = 'games', children, showStars = true, heroImage = null }) => {
  const themeConfig = roomThemes[theme] || roomThemes.games;

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: themeConfig.bgColor }}>
      {/* 3D Background */}
      {showStars && (
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 5] }}>
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          </Canvas>
        </div>
      )}

      {/* Gradient Overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${themeConfig.gradient} opacity-20 z-0`} />

      {/* Noise Texture */}
      <div 
        className="absolute inset-0 z-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px'
        }}
      />

      {/* Hero Image Background (if provided) */}
      {heroImage && (
        <div className="absolute inset-0 z-0">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImage})` }}
          />
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};
