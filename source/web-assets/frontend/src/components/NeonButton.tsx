
import { motion } from 'framer-motion';

interface NeonButtonProps {
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  variant?: 'primary' | 'ghost' | 'gradient';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  [key: string]: any;
}

export const NeonButton = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '',
  disabled = false,
  type = 'button',
  ...rest  // Forward all other props including onMouseEnter
}: NeonButtonProps) => {
  const baseClasses = "relative overflow-hidden rounded-full px-8 py-3 font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900";
  
  const variantClasses = {
    primary: "bg-white text-black hover:bg-slate-200 shadow-[0_0_20px_rgba(255,255,255,0.3)]",
    ghost: "bg-transparent border border-white/20 text-white hover:bg-white/10",
    gradient: "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-[0_0_20px_rgba(219,39,119,0.4)]"
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      {...rest}  // Spread remaining props
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
    >
      {children}
    </motion.button>
  );
};
