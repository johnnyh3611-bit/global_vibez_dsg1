/**
 * Card Game Sound Manager
 * Provides realistic card game sound effects using Web Audio API
 */

class CardSoundManager {
  constructor() {
    this.audioContext = null;
    this.sounds = {};
    this.enabled = true;
    this.volume = 0.7;
    
    // Initialize audio context on first user interaction
    this.init();
  }

  init() {
    if (typeof window !== 'undefined') {
      // Create audio context lazily
      document.addEventListener('click', () => {
        if (!this.audioContext) {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
      }, { once: true });
    }
  }

  /**
   * Generate a card shuffle sound using noise and filtering
   */
  playCardShuffle() {
    if (!this.enabled || !this.audioContext) return;

    const duration = 0.8;
    const now = this.audioContext.currentTime;

    // Create noise for shuffle sound
    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate pink noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    // Filter to make it sound like cards
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 1;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);

    noise.start(now);
    noise.stop(now + duration);
  }

  /**
   * Generate a card deal sound (whoosh + snap)
   */
  playCardDeal() {
    if (!this.enabled || !this.audioContext) return;

    const duration = 0.15;
    const now = this.audioContext.currentTime;

    // Oscillator for whoosh
    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + duration);

    // Snap sound (short noise burst)
    const noiseBuffer = this.audioContext.createBuffer(1, 4410, this.audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < 4410; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(this.volume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(now);
    osc.stop(now + duration);
    noise.start(now + duration * 0.8);
    noise.stop(now + duration);
  }

  /**
   * Generate a card flip sound
   */
  playCardFlip() {
    if (!this.enabled || !this.audioContext) return;

    const duration = 0.08;
    const now = this.audioContext.currentTime;

    const osc = this.audioContext.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + duration);

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(this.volume * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * Generate a card slam sound (heavy impact)
   */
  playCardSlam() {
    if (!this.enabled || !this.audioContext) return;

    const duration = 0.25;
    const now = this.audioContext.currentTime;

    // Create impact sound with low frequency
    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + duration);

    // Add noise for texture
    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(this.volume * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(now);
    osc.stop(now + duration);
    noise.start(now);
    noise.stop(now + duration);

    // Trigger haptic feedback if available
    this.triggerHaptic('medium');
  }

  /**
   * Generate a chip clink sound
   */
  playChipClink() {
    if (!this.enabled || !this.audioContext) return;

    const duration = 0.15;
    const now = this.audioContext.currentTime;

    // Multiple oscillators for metallic sound
    const freqs = [1200, 1600, 2400];
    freqs.forEach((freq, i) => {
      const osc = this.audioContext.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = this.audioContext.createGain();
      gain.gain.setValueAtTime(this.volume * 0.2, now + i * 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration + i * 0.02);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start(now + i * 0.02);
      osc.stop(now + duration + i * 0.02);
    });

    this.triggerHaptic('light');
  }

  /**
   * Generate a winning sound (celebratory)
   */
  playWinSound() {
    if (!this.enabled || !this.audioContext) return;

    const now = this.audioContext.currentTime;
    
    // Ascending arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C-E-G-C
    notes.forEach((freq, i) => {
      const osc = this.audioContext.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = this.audioContext.createGain();
      gain.gain.setValueAtTime(this.volume * 0.4, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.3);
    });

    this.triggerHaptic('heavy');
  }

  /**
   * Generate a losing sound
   */
  playLoseSound() {
    if (!this.enabled || !this.audioContext) return;

    const now = this.audioContext.currentTime;
    
    // Descending notes
    const notes = [659.25, 523.25, 392.00]; // E-C-G
    notes.forEach((freq, i) => {
      const osc = this.audioContext.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = this.audioContext.createGain();
      gain.gain.setValueAtTime(this.volume * 0.3, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.4);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.4);
    });
  }

  /**
   * Roulette ball whoosh — long descending noise envelope used by
   * <BallSpin> when the ball is launched. Pairs with `playRouletteClick`.
   */
  playRouletteWhoosh() {
    if (!this.enabled || !this.audioContext) return;
    const now = this.audioContext.currentTime;
    const duration = 1.4;

    // Filtered noise burst
    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + duration);
    filter.Q.value = 1.4;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(this.volume * 0.35, now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);

    noise.start(now);
    noise.stop(now + duration);
    this.triggerHaptic('light');
  }

  /**
   * Roulette pocket click — short bright impact when the ball settles.
   */
  playRouletteClick() {
    if (!this.enabled || !this.audioContext) return;
    const now = this.audioContext.currentTime;

    const osc = this.audioContext.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.06);

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(this.volume * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.09);
    this.triggerHaptic('medium');
  }

  /**
   * Trigger haptic feedback (vibration)
   */
  triggerHaptic(intensity = 'medium') {
    if (!navigator.vibrate) return;

    const patterns = {
      light: 10,
      medium: 25,
      heavy: 50
    };

    navigator.vibrate(patterns[intensity] || 25);
  }

  /**
   * Toggle sound on/off
   */
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  /**
   * Set volume (0-1)
   */
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }
}

// Create singleton instance
const cardSoundManager = new CardSoundManager();

export default cardSoundManager;
