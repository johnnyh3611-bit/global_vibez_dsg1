import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import ProgressiveAbcQuiz from "@/components/dating/ProgressiveAbcQuiz";

/**
 * Return-visit vibe check — 3 more A/B/C questions each time
 * so matching for dating + gaming stays accurate without typing.
 */
export default function VibeCheck() {
  const navigate = useNavigate();
  const [justFinished, setJustFinished] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#080C16] via-[#0F1628] to-[#080C16] p-4 flex items-center justify-center">
      <div className="w-full max-w-xl">
        <motion.div
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-6"
        >
          <h1 className="text-3xl md:text-4xl font-black text-transparent bg-gradient-to-r from-fuchsia-400 via-pink-400 to-cyan-400 bg-clip-text mb-2">
            Quick vibe check
          </h1>
          <p className="text-white/60 text-sm">
            Three taps. No typing. Helps us match you better for dates and games.
          </p>
        </motion.div>

        <div className="bg-black/60 backdrop-blur-xl rounded-3xl border-2 border-fuchsia-500/30 p-6 md:p-8">
          <ProgressiveAbcQuiz
            setup={false}
            onComplete={() => setJustFinished(true)}
          />
          {justFinished && (
            <button
              type="button"
              onClick={() => navigate("/dating/discover")}
              className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 font-bold text-white"
            >
              Back to discover
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-3 w-full py-2 text-sm text-white/50 hover:text-white/80"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
