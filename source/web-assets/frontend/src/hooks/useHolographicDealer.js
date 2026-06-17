import { useEffect, useState } from 'react';
import soundManager from '@/utils/soundManager';

/**
 * Drives the holographic dealer's dealing animation state:
 *   - arm swing angle (radians)
 *   - ephemeral in-flight card sprites
 * Returns `{ dealingCards }` for the view layer to render.
 */
export const useHolographicDealer = ({ isDealing }) => {
  const [dealingCards, setDealingCards] = useState([]);

  useEffect(() => {
    if (!isDealing) return undefined;

    const interval = setInterval(() => {
      if (Math.random() >= 0.3) return;

      const newCard = {
        id: `${Date.now()}-${Math.random()}`,
        rotation: Math.random() * 360,
      };
      setDealingCards((prev) => [...prev, newCard]);
      soundManager.cardDeal();

      setTimeout(() => {
        setDealingCards((prev) => prev.filter((c) => c.id !== newCard.id));
      }, 1000);
    }, 200);

    return () => clearInterval(interval);
  }, [isDealing]);

  return { dealingCards };
};

export default useHolographicDealer;
