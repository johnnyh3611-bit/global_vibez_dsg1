import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, Gamepad2 } from 'lucide-react';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  game: Gamepad2
};

const colorMap = {
  success: 'from-green-500/90 to-emerald-600/90 border-green-400/60',
  error: 'from-red-500/90 to-rose-600/90 border-red-400/60',
  info: 'from-cyan-500/90 to-blue-600/90 border-cyan-400/60',
  game: 'from-fuchsia-500/90 to-pink-600/90 border-fuchsia-400/60'
};

export function ToastNotification({ 
  message, 
  type = 'info', 
  duration = 5000, 
  onClose,
  title 
}) {
  const Icon = iconMap[type];
  const colors = colorMap[type];

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`
        backdrop-blur-xl bg-gradient-to-r ${colors}
        border-2 rounded-2xl shadow-[0_0_40px_rgba(232,121,249,0.5)]
        p-4 min-w-[320px] max-w-md
      `}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Icon className="w-6 h-6 text-white" />
        </div>
        
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="text-white font-bold text-sm mb-1">
              {title}
            </h4>
          )}
          <p className="text-white/90 text-sm">
            {message}
          </p>
        </div>

        <button
          onClick={onClose}
          className="flex-shrink-0 text-white/60 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Progress bar */}
      {duration > 0 && (
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          className="h-1 bg-white/30 rounded-full mt-3"
        />
      )}
    </motion.div>
  );
}

export function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastNotification
            key={toast.id}
            {...toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
