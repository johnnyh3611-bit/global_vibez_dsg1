// Casino Sound Effects Manager
export class CasinoSounds {
  constructor() {
    this.sounds = {
      // Card sounds
      cardSlide: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYiFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhQ=='),
      cardFlip: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAgoSGiIqMjo6QkpKUlJaWmJiamJqYmpiYlpaUlJKSkI6OjIqIhoSCgH5+fHx6enh4dnZ0dHJycHBubm5ubm5ubm5ubm5ub3Bxc3R2d3l7fX+BhIaJi42QkpWXmpyfoqWoq62wsbO1t7i6u7y9vr/AwQ=='),
      
      // Chip sounds  
      chipClick: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBg4WIi46RlJeaoJ6dmZWRjYmFgX59e3l3dXNxb21rbWtpa2ttb3Fzd3l9gYWJjZGVmZ2gnqSmnKKYlJCMiIR/e3dzb2tnam5ydnt/g4eKjpCTlpmcn6Kko6GfnZuZl5WTkY+NjYuLi4uLi4uNjY+RlQ=='),
      chipStack: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYmMkJSYm5+hnp2bmpaTkI6LiIWCf3x6d3VzdHZ4e36BhYiMj5KVmJqcnp6dnJqYlpSSkI6Mi4qJiYmJiYqMjY+RlJeaoJ6cmpeTkY6LiIWCf3x5d3V0dHZ5fH+ChYiLjpGUl5qcnZ6dnJqYlpSSkI6MioiGhA=='),
      
      // Win/Loss sounds
      win: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAg4aJjI+Slpqdm6Gloaegnpyal5SSj4yJhoOAf317eXd2dXR0dXZ4en2AhIeKjpGUl5qcnp+fnp2bmpeTkY6LiIWCf3x5dnRycXFydHd6fYCDhomMj5KUlpianJ2dnJuamJaUko+NioeFgn98eXZzcQ=='),
      lose: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBf317eXd1c3Fvbmxrampqa2xucHN1eHt+gYSHioyOkJGSk5OTkpGPjoyKiIaEgn9+fHp5eHd3d3h5e36AgYOFh4mLjI6PkJGRkZCPjoyCgYB+fXt6eXh4eHl6fH6AgoSGiIqMjY+QkZGRkJCPjoyCgH9+fHt6eQ=='),
      
      // Dealer voice (text-to-speech would be better, but using subtle tones)
      dealerSpeak: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAhIiMkJSYnKCjoqCdmpaSjo2KhoJ+e3h1c3Fwb29wcXN2eX2AhIeLj5KVmJqbnJuamJaUko+NioeFgn9+fXx8fH1+gIKFh4qNkJKVl5mam5qZmJaUko+NioeFgn9+fHt6enp8foGEh4qNkJOWmJqbm5qZmJaT'),
      
      // Background ambiance
      ambiance: null // Will be created dynamically
    };
    
    // Set volumes
    this.sounds.cardSlide.volume = 0.3;
    this.sounds.cardFlip.volume = 0.25;
    this.sounds.chipClick.volume = 0.4;
    this.sounds.chipStack.volume = 0.35;
    this.sounds.win.volume = 0.5;
    this.sounds.lose.volume = 0.4;
    this.sounds.dealerSpeak.volume = 0.2;
    
    this.enabled = true;
  }
  
  play(soundName) {
    if (!this.enabled || !this.sounds[soundName]) return;
    
    try {
      const sound = this.sounds[soundName].cloneNode();
      sound.volume = this.sounds[soundName].volume;
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Sound playback failed:', soundName, e);
      }
    }
  }
  
  playCardDeal() {
    this.play('cardSlide');
    setTimeout(() => this.play('cardFlip'), 100);
  }
  
  playChipBet() {
    this.play('chipClick');
    setTimeout(() => this.play('chipStack'), 80);
  }
  
  playWin() {
    this.play('win');
  }
  
  playLose() {
    this.play('lose');
  }
  
  playDealerSpeak() {
    this.play('dealerSpeak');
  }
  
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
  
  // Background casino ambiance (subtle)
  startAmbiance() {
    // Create subtle background hum
    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        
        // Create very subtle low-frequency hum for atmosphere
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 60; // Low hum
        gainNode.gain.value = 0.01; // Very quiet
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start();
        
        this.sounds.ambiance = { oscillator, gainNode, audioContext };
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Ambiance sound failed:', e);
        }
      }
    }
  }
  
  stopAmbiance() {
    if (this.sounds.ambiance) {
      this.sounds.ambiance.oscillator.stop();
      this.sounds.ambiance.audioContext.close();
      this.sounds.ambiance = null;
    }
  }
}

export default CasinoSounds;
