import { motion } from 'framer-motion';

export const DealerSpeechBubble = ({ phrase }) => {
  if (!phrase) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm border border-cyan-400/40 rounded-2xl px-4 py-2 min-w-max shadow-lg shadow-cyan-500/20"
      data-testid="dealer-speech-bubble"
    >
      <p className="text-white text-sm font-medium">{phrase}</p>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-cyan-400/40" />
    </motion.div>
  );
};

export default DealerSpeechBubble;
