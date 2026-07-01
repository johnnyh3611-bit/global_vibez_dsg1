import React from 'react';
import { motion } from 'framer-motion';

// Loading Skeleton Component
export function LoadingSkeleton({ className = '', variant = 'card' }) {
  if (variant === 'card') {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="bg-slate-800/50 rounded-lg p-6 space-y-4">
          <div className="h-4 bg-slate-700 rounded w-3/4"></div>
          <div className="h-4 bg-slate-700 rounded w-1/2"></div>
          <div className="h-20 bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={`animate-pulse space-y-3 ${className}`}>
        {[...Array(5)].map((_, i) => (
          <div key={_.id || _.name || `item-${i}`} className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-700 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-700 rounded w-3/4"></div>
              <div className="h-3 bg-slate-700 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'grid') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
        {[...Array(6)].map((_, i) => (
          <div key={_.id || _.name || `item-${i}`} className="animate-pulse">
            <div className="bg-slate-800/50 rounded-lg h-64"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`animate-pulse ${className}`}>
      <div className="h-4 bg-slate-700 rounded w-full"></div>
    </div>
  );
}

// Empty State Component
export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action,
  actionLabel = 'Get Started'
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-12 px-4"
    >
      {Icon && (
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-800/50 flex items-center justify-center">
          <Icon className="w-12 h-12 text-slate-600" />
        </div>
      )}
      <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400 mb-6 max-w-md mx-auto">{description}</p>
      {action && (
        <button
          onClick={action}
          className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-700 text-white font-bold rounded-lg hover:from-cyan-700 hover:to-blue-800 transition-all"
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}

// Error State Component
export function ErrorState({ 
  title = 'Something went wrong',
  message = 'Please try again later',
  retry,
  retryLabel = 'Try Again'
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-12 px-4"
    >
      <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
        <div className="text-6xl">⚠️</div>
      </div>
      <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400 mb-6 max-w-md mx-auto">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="px-6 py-3 bg-slate-700 text-white font-bold rounded-lg hover:bg-slate-600 transition-all"
        >
          {retryLabel}
        </button>
      )}
    </motion.div>
  );
}

// Loading Spinner
export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <div className="animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400 w-full h-full"></div>
    </div>
  );
}

// Success Toast
export function SuccessToast({ message, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3"
    >
      <div className="text-2xl">✓</div>
      <span className="font-medium">{message}</span>
      {onClose && (
        <button onClick={onClose} className="ml-4 hover:opacity-80">
          ✕
        </button>
      )}
    </motion.div>
  );
}

// Error Toast
export function ErrorToast({ message, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      className="fixed top-4 right-4 z-50 bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3"
    >
      <div className="text-2xl">⚠</div>
      <span className="font-medium">{message}</span>
      {onClose && (
        <button onClick={onClose} className="ml-4 hover:opacity-80">
          ✕
        </button>
      )}
    </motion.div>
  );
}

// Page Transition Wrapper
export function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}

// Confirm Dialog
export function ConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 border border-white/10 rounded-lg p-6 max-w-md mx-4"
      >
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-lg font-bold transition-all ${
              danger
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 text-white'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Progress Bar
export function ProgressBar({ progress, className = '' }) {
  return (
    <div className={`w-full bg-slate-700 rounded-full h-2 overflow-hidden ${className}`}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5 }}
        className="h-full bg-gradient-to-r from-cyan-500 to-blue-600"
      />
    </div>
  );
}
