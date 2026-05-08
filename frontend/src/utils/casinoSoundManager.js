/**
 * Casino Sound Manager
 * Handles all casino-related sound effects
 */

class CasinoSoundManager {
  constructor() {
    this.context = null;
    this.sounds = {};
    this.enabled = true;
    this.volume = 0.5;
    this.initAudioContext();
  }

  initAudioContext() {
    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('AudioContext initialization failed (browser may not support it):', e);
    }
  }

  // Synthesized sound effects using Web Audio API
  playCardShuffle() {
    if (!this.enabled || !this.context) return;
    
    const duration = 1.2;
    const now = this.context.currentTime;
    
    // Create noise for shuffle sound
    const bufferSize = this.context.sampleRate * duration;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      // Pink noise with envelope
      const envelope = Math.sin((i / bufferSize) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * 0.3 * envelope;
    }
    
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    
    const gainNode = this.context.createGain();
    gainNode.gain.setValueAtTime(this.volume * 0.4, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.context.destination);
    
    source.start(now);
    source.stop(now + duration);
  }

  playCardDeal() {
    if (!this.enabled || !this.context) return;
    
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(150, now);
    oscillator.frequency.exponentialRampToValueAtTime(80, now + 0.05);
    
    gainNode.gain.setValueAtTime(this.volume * 0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  }

  playCardFlip() {
    if (!this.enabled || !this.context) return;
    
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(200, now);
    oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.08);
    
    gainNode.gain.setValueAtTime(this.volume * 0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.08);
  }

  playCardSlide() {
    if (!this.enabled || !this.context) return;
    
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(120, now);
    oscillator.frequency.linearRampToValueAtTime(90, now + 0.15);
    
    gainNode.gain.setValueAtTime(this.volume * 0.15, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.15);
  }

  playChipPlace() {
    if (!this.enabled || !this.context) return;
    
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, now);
    oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.06);
    
    gainNode.gain.setValueAtTime(this.volume * 0.4, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.06);
  }

  playChipStack() {
    if (!this.enabled || !this.context) return;
    
    // Multiple chip sounds in quick succession
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.playChipPlace(), i * 50);
    }
  }

  playWinSound() {
    if (!this.enabled || !this.context) return;
    
    const now = this.context.currentTime;
    
    // Ascending arpeggio for win
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    
    notes.forEach((freq, i) => {
      const oscillator = this.context.createOscillator();
      const gainNode = this.context.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;
      
      const startTime = now + (i * 0.1);
      gainNode.gain.setValueAtTime(this.volume * 0.3, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(this.context.destination);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.3);
    });
  }

  playLoseSound() {
    if (!this.enabled || !this.context) return;
    
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, now);
    oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.5);
    
    gainNode.gain.setValueAtTime(this.volume * 0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.5);
  }

  playTableAmbience() {
    if (!this.enabled || !this.context) return;
    
    // Low rumble for casino ambience
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = 60;
    
    gainNode.gain.setValueAtTime(this.volume * 0.05, now);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    
    oscillator.start(now);
    
    // Store for later stopping
    this.ambienceOscillator = oscillator;
    this.ambienceGain = gainNode;
  }

  stopTableAmbience() {
    if (this.ambienceOscillator) {
      const now = this.context.currentTime;
      this.ambienceGain.gain.exponentialRampToValueAtTime(0.01, now + 1);
      this.ambienceOscillator.stop(now + 1);
      this.ambienceOscillator = null;
      this.ambienceGain = null;
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopTableAmbience();
    }
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
  }
}

// Singleton instance
const casinoSounds = new CasinoSoundManager();

export default casinoSounds;
