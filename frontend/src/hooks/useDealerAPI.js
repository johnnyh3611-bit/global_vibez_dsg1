/**
 * Custom hook for AI Dealer API interactions
 * Handles REST API calls to dealer personality engine
 */
import { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Hook for fetching personalized dealer greeting
 */
export const useDealerGreeting = (playerId, playerName) => {
  const [greeting, setGreeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGreeting = async () => {
      if (!playerId || !playerName) return;
      
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/dealer/greeting?player_id=${playerId}&player_name=${encodeURIComponent(playerName)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) throw new Error('Failed to fetch greeting');

        const data = await response.json();
        setGreeting(data);
        setError(null);
      } catch (err) {
        // console.error('Dealer greeting error:', err);
        setError(err.message);
        // Fallback greeting
        setGreeting({
          greeting: `Welcome to the lounge, ${playerName}.`,
          animation: 'welcoming_gesture',
          delay_ms: 800
        });
      } finally {
        setLoading(false);
      }
    };

    fetchGreeting();
  }, [playerId, playerName]);

  return { greeting, loading, error };
};

/**
 * Hook for fetching dealer vibe/mood
 */
export const useDealerVibe = (playerStats) => {
  const [vibe, setVibe] = useState(null);
  const [personality, setPersonality] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchVibe = async (stats) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/dealer/vibe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify(stats)
      });

      if (!response.ok) throw new Error('Failed to fetch vibe');

      const data = await response.json();
      setVibe(data.vibe);
      setPersonality(data.personality);
    } catch (err) {
      // console.error('Dealer vibe error:', err);
      setVibe('Neutral');
    } finally {
      setLoading(false);
    }
  };

  return { vibe, personality, loading, fetchVibe };
};

/**
 * Hook for fetching dealer reactions to game events
 */
export const useDealerReaction = () => {
  const [reaction, setReaction] = useState(null);
  const [loading, setLoading] = useState(false);

  const getReaction = async (eventType, context = {}) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/dealer/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          event_type: eventType,
          context
        })
      });

      if (!response.ok) throw new Error('Failed to fetch reaction');

      const data = await response.json();
      if (data.success) {
        setReaction(data.reaction);
        return data.reaction;
      }
    } catch (err) {
      // console.error('Dealer reaction error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { reaction, loading, getReaction };
};

/**
 * Hook for fetching provably fair deck hash
 */
export const useProvablyFairDeck = () => {
  const [deckData, setDeckData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateFairDeck = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/dealer/spades/fair-deck`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to generate fair deck');

      const data = await response.json();
      setDeckData(data);
      setError(null);
      return data;
    } catch (err) {
      // console.error('Fair deck error:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { deckData, loading, error, generateFairDeck };
};

/**
 * Hook for updating dealer's memory of player
 */
export const useDealerMemory = () => {
  const updateMemory = async (playerId, event, value = null) => {
    try {
      await fetch(`${API_URL}/api/dealer/update-memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ player_id: playerId, event, value })
      });
    } catch (err) {
      // console.error('Dealer memory update error:', err);
    }
  };

  return { updateMemory };
};

/**
 * Hook for fetching social commentary
 */
export const useDealerSocialCommentary = () => {
  const [commentary, setCommentary] = useState(null);
  const [loading, setLoading] = useState(false);

  const getCommentary = async (playerA, playerB, gameEvent) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/dealer/social-commentary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          player_a: playerA,
          player_b: playerB,
          game_event: gameEvent
        })
      });

      if (!response.ok) throw new Error('Failed to fetch commentary');

      const data = await response.json();
      setCommentary(data);
      return data;
    } catch (err) {
      // console.error('Social commentary error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { commentary, loading, getCommentary };
};
