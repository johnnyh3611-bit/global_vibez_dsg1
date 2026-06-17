import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

// Reusable back button for all pages
// Positioned in top-left corner with glassmorphism styling

type BackButtonVariant = 'default' | 'minimal' | 'casino';
type BackButtonSize = 'default' | 'small';
type BackButtonPosition = 'fixed' | 'absolute';

interface BackButtonProps {
  /** Path string or history delta (defaults to -1 = go back). */
  to?: string | number;
  label?: string;
  className?: string;
  position?: BackButtonPosition;
  variant?: BackButtonVariant;
  size?: BackButtonSize;
  /** Optional custom click handler (overrides default navigate behaviour). */
  onClick?: () => void;
}

export default function BackButton({
  to = -1,
  label = 'Back',
  className = '',
  position = 'fixed',
  variant = 'default',
  size = 'default',
  onClick,
}: BackButtonProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (typeof to === 'string') {
      navigate(to);
    } else {
      navigate(to);
    }
  };

  const variants: Record<BackButtonVariant, string> = {
    default: 'bg-black/40 backdrop-blur-xl border border-white/20 hover:bg-white/10',
    minimal: 'bg-transparent hover:bg-white/5',
    casino: 'bg-black/60 backdrop-blur-xl border border-[#D4AF37]/40 hover:border-[#D4AF37]',
  };

  const sizeStyles: Record<BackButtonSize, { padding: string; icon: string; text: string }> = {
    default: { padding: 'px-4 py-2', icon: 'w-5 h-5', text: 'font-semibold' },
    small: { padding: 'px-3 py-1.5', icon: 'w-4 h-4', text: 'font-semibold text-sm' },
  };

  const currentSize = sizeStyles[size];

  return (
    <motion.button
      whileHover={{ scale: 1.05, x: -5 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleBack}
      className={`${position} top-6 left-6 z-50 ${currentSize.padding} rounded-lg flex items-center gap-2 text-white transition-all ${variants[variant]} ${className}`}
    >
      <ArrowLeft className={currentSize.icon} />
      <span className={currentSize.text}>{label}</span>
    </motion.button>
  );
}
