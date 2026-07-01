import React from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

/**
 * Gesture Control Panel - UI for triggering avatar gestures
 */
export function GesturePanel({ onGesture, disabled = false }: { onGesture?: any, disabled?: any }) {
  const gestures = [
    { id: 'wave', emoji: '👋', label: 'Wave', color: 'from-blue-500 to-cyan-500' },
    { id: 'heart', emoji: '❤️', label: 'Heart', color: 'from-pink-500 to-red-500' },
    { id: 'thumbsup', emoji: '👍', label: 'Like', color: 'from-green-500 to-emerald-500' },
    { id: 'dance', emoji: '💃', label: 'Dance', color: 'from-purple-500 to-pink-500' }
  ];

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-20"
    >
      <div className="bg-black/80 backdrop-blur-md rounded-2xl p-4 border border-white/20">
        <p className="text-white/70 text-xs text-center mb-3">Express Yourself</p>
        <div className="flex gap-2">
          {gestures.map((gesture) => (
            <motion.button
              key={gesture.id}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => !disabled && onGesture(gesture.id)}
              disabled={disabled}
              className={`
                px-4 py-3 rounded-xl
                bg-gradient-to-br ${gesture.color}
                hover:shadow-lg hover:shadow-${gesture.color.split(' ')[1]}/50
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                flex flex-col items-center gap-1
              `}
            >
              <span className="text-2xl">{gesture.emoji}</span>
              <span className="text-white text-xs font-medium">{gesture.label}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Avatar Customization Panel
 */
export function AvatarCustomizationPanel({ currentColor, onColorChange, disabled = false }: { currentColor?: any, onColorChange?: any, disabled?: any }) {
  const colors = [
    { name: 'Pink', value: '#ff69b4' },
    { name: 'Blue', value: '#00bfff' },
    { name: 'Purple', value: '#9370db' },
    { name: 'Green', value: '#32cd32' },
    { name: 'Orange', value: '#ff8c00' },
    { name: 'Red', value: '#ff4444' }
  ];

  return (
    <motion.div
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="absolute bottom-4 left-4 z-10 bg-black/80 backdrop-blur-md rounded-xl p-4"
    >
      <p className="text-white text-sm font-bold mb-3">Avatar Color</p>
      <div className="grid grid-cols-3 gap-2">
        {colors.map((color) => (
          <motion.button
            key={color.value}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => !disabled && onColorChange(color.value)}
            disabled={disabled}
            className={`
              w-10 h-10 rounded-full
              transition-all duration-200
              ${currentColor === color.value ? 'ring-4 ring-white ring-offset-2 ring-offset-black' : 'ring-2 ring-white/30'}
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            style={{ backgroundColor: color.value }}
            title={color.name}
          />
        ))}
      </div>
    </motion.div>
  );
}

/**
 * Quick Actions Panel
 */
export function QuickActionsPanel({ onAction, disabled = false }: { onAction?: any, disabled?: any }) {
  const actions = [
    { id: 'rose', emoji: '🌹', label: 'Give Rose' },
    { id: 'ball', emoji: '⚽', label: 'Throw Ball' },
    { id: 'toast', emoji: '🥂', label: 'Toast' },
    { id: 'hearts', emoji: '💕', label: 'Send Hearts' }
  ];

  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="absolute top-1/2 right-4 transform -translate-y-1/2 z-10"
    >
      <div className="bg-black/80 backdrop-blur-md rounded-xl p-3 space-y-2">
        <p className="text-white/70 text-xs text-center mb-2">Actions</p>
        {actions.map((action) => (
          <motion.button
            key={action.id}
            whileHover={{ scale: 1.1, x: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => !disabled && onAction(action.id)}
            disabled={disabled}
            className="
              w-12 h-12 rounded-lg
              bg-gradient-to-br from-purple-600 to-pink-600
              hover:shadow-lg hover:shadow-purple-500/50
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center
            "
            title={action.label}
          >
            <span className="text-2xl">{action.emoji}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
