// Voice integration with ElevenLabs API
// NOTE: This requires ElevenLabs API key
import { isAIDealerVoiceMuted } from '../utils/aiDealerVoice';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Hook for playing AI Dealer voice using ElevenLabs
 * @param {string} voiceId - ElevenLabs voice ID (your cloned voice)
 * @returns {object} - playVoice function and loading state
 */
export const useAIDealerVoice = (voiceId = 'default') => {
  const playVoice = async (text) => {
    // Master mute check — global menu-bar toggle (LOCKED v8.0).
    // Returns silently so callers don't need to wrap each call in `if`.
    if (isAIDealerVoiceMuted()) {
      return { success: true, muted: true };
    }
    try {
      // Option 1: Direct ElevenLabs API call (requires frontend API key)
      // const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'xi-api-key': process.env.REACT_APP_ELEVENLABS_KEY
      //   },
      //   body: JSON.stringify({
      //     text,
      //     model_id: 'eleven_flash_v2_5',
      //     voice_settings: {
      //       stability: 0.5,
      //       similarity_boost: 0.75
      //     }
      //   })
      // });

      // Option 2: Backend proxy (recommended for security)
      const response = await fetch(`${API_URL}/api/ai/voice-synthesis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          voice_id: voiceId
        })
      });

      if (!response.ok) {
        throw new Error('Voice synthesis failed');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      await audio.play();
      
      return { success: true };
    } catch (error) {
      // console.error('Voice playback error:', error);
      return { success: false, error };
    }
  };

  return { playVoice };
};

/**
 * Preload common dealer phrases for faster playback
 * Note: This is a helper function - should be called from React components
 */
export const preloadDealerPhrases = async (phrases = []) => {
  // Moved to component level to avoid calling hooks outside React
  return Promise.resolve();
};

/**
 * Get AI Dealer personality phrases
 */
export const getDealerPhrases = () => ({
  welcome: [
    "Welcome back to the lounge.",
    "Good to see you again, champion.",
    "The tables have missed you.",
  ],
  encouragement: [
    "I'm waiting for you at the table.",
    "Let's see if luck is on your side tonight.",
    "The chips are ready. Are you?",
    "Time to show them what you're made of.",
  ],
  victory: [
    "Knew you had it in you!",
    "That's how it's done!",
    "The house didn't stand a chance.",
  ],
  defeat: [
    "Close one. Next hand is yours.",
    "That's the game. Ready to bounce back?",
    "Every loss is a lesson. Let's go again.",
  ],
  social: [
    "I see you've got some admirers.",
    "Someone's been eyeing your table.",
    "Looks like you've got a vibe request.",
  ]
});

export default { useAIDealerVoice, preloadDealerPhrases, getDealerPhrases };
