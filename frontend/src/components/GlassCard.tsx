import { motion } from 'framer-motion';

export const GlassCard = ({ 
  children, 
  className = '', 
  hoverable = true,
  onClick = null,
  glow = false,
  glowColor = 'rgba(255,255,255,0.2)',
  variant = 'default' // 'default', 'social', 'gaming'
}) => {
  // Enhanced Glassmorphism - Stronger blur, better transparency
  const baseClasses = "backdrop-blur-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border shadow-2xl rounded-2xl";
  
  // Variant-specific styling
  const variantClasses = {
    default: "border-white/20 shadow-white/10",
    social: "border-cyan-400/30 shadow-cyan-400/20", // Cyan for social
    gaming: "border-fuchsia-400/30 shadow-fuchsia-400/20" // Magenta for gaming
  };
  
  const hoverClasses = hoverable 
    ? "hover:bg-white/10 hover:border-opacity-50 hover:scale-[1.02] cursor-pointer transition-all duration-300" 
    : "";
  
  const cardStyle = glow ? {
    boxShadow: `0 0 40px ${glowColor}, 0 0 80px ${glowColor}30, inset 0 1px 1px rgba(255,255,255,0.1)`
  } : {
    boxShadow: `0 8px 32px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.1)`
  };

  if (hoverable || onClick) {
    return (
      <motion.div
        className={`${baseClasses} ${variantClasses[variant]} ${hoverClasses} ${className}`}
        style={cardStyle}
        onClick={onClick}
        whileHover={hoverable ? { scale: 1.02 } : {}}
        whileTap={onClick ? { scale: 0.98 } : {}}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} style={cardStyle}>
      {children}
    </div>
  );
};
