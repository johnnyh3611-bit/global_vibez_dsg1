
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProfessionalCasinoTable from '@/components/casino/ProfessionalCasinoTable';
import dealerVoice, { DealerCallouts } from '@/utils/dealerVoice';
import casinoSounds from '@/utils/casinoSoundManager';

export default function ProfessionalTablePreview() {
  const navigate = useNavigate();
  const [dealerStyle, setDealerStyle] = useState('classic_male');

  const dealerOptions = [
    { id: 'classic_male', name: 'James (Classic)' },
    { id: 'elegant_female', name: 'Sophia (Elegant)' },
    { id: 'modern_female', name: 'Aurora (Modern)' },
    { id: 'executive_male', name: 'Alexander (VIP)' }
  ];

  const handleBet = () => {
    casinoSounds.playChipPlace();
    dealerVoice.speak(DealerCallouts.PLAYER_BET('Player', '$100'));
  };

  const handleHit = () => {
    casinoSounds.playCardDeal();
    dealerVoice.speak("Hit.");
  };

  const handleStand = () => {
    casinoSounds.playCardSlide();
    dealerVoice.speak(DealerCallouts.BJ_DEALER_STANDS);
  };

  const handleInsurance = () => {
    casinoSounds.playChipStack();
    dealerVoice.speak("Insurance bet accepted.");
  };

  return (
    <div className="relative w-full h-screen">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/games')}
        className="absolute top-4 left-4 z-50 text-white hover:bg-white/10"
      >
        <ArrowLeft className="mr-2 h-5 w-5" />
        Back
      </Button>

      {/* Dealer Selector */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex gap-2">
        {dealerOptions.map(option => (
          <button
            key={option.id}
            onClick={() => setDealerStyle(option.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              dealerStyle === option.id
                ? 'bg-yellow-500 text-black'
                : 'bg-black/50 text-white hover:bg-black/70'
            }`}
          >
            {option.name}
          </button>
        ))}
      </div>

      {/* Professional Casino Table */}
      <ProfessionalCasinoTable
        onBet={handleBet}
        onHit={handleHit}
        onStand={handleStand}
        onInsurance={handleInsurance}
        playerChips={25480}
        handTotal={18}
        dealerStyle={dealerStyle}
        gameType="blackjack"
      />
    </div>
  );
}
