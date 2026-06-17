import React from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';

/**
 * Voice Activity Indicator - Shows speaking status
 */
export function VoiceIndicator({ speaking, muted, userName = 'User', className = '' }: { speaking?: any, muted?: any, userName?: any, className?: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center gap-2 ${className}`}
    >
      {muted ? (
        <div className="relative">
          <MicOff className="w-5 h-5 text-red-500" />
        </div>
      ) : speaking ? (
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="relative"
        >
          <Mic className="w-5 h-5 text-green-500" />
          <motion.div
            className="absolute inset-0 rounded-full bg-green-500/30"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        </motion.div>
      ) : (
        <Mic className="w-5 h-5 text-white/50" />
      )}
      
      <span className={`text-sm font-medium ${speaking ? 'text-green-400' : 'text-white/70'}`}>
        {userName}
      </span>
      
      {speaking && !muted && (
        <motion.div className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={`item-${i}`}
              className="w-1 bg-green-500 rounded-full"
              animate={{
                height: ['8px', '16px', '8px']
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                delay: i * 0.1
              }}
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Voice Status Overlay - Shows voice connection status
 */
export function VoiceStatusOverlay({ connected, 
  localSpeaking, 
  remoteSpeaking, 
  localMuted, 
  localName = 'You',
  remoteName = 'Partner' }: { connected?: any, localSpeaking?: any, remoteSpeaking?: any, localMuted?: any, localName?: any, remoteName?: any }) {
  return (
    <div className="absolute top-24 left-4 z-10 bg-black/80 backdrop-blur-md rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-white/70 text-xs font-medium">
          {connected ? 'Voice Connected' : 'Connecting...'}
        </span>
      </div>
      
      <VoiceIndicator
        speaking={localSpeaking}
        muted={localMuted}
        userName={localName}
      />
      
      <VoiceIndicator
        speaking={remoteSpeaking}
        muted={false}
        userName={remoteName}
      />
    </div>
  );
}
