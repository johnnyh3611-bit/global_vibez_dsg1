// Sound Manager - Central audio system for Global Vibez DSG
// Uses free sound effects from browser APIs and simple audio generation

class SoundManager {
  constructor() {
    this.enabled = true;
    this.volume = 0.3; // 30% volume by default
    this.audioContext = null;
    
    // Initialize Web Audio API
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  // Enable/disable all sounds
  setEnabled(enabled) {
    this.enabled = enabled;
    localStorage.setItem('soundEnabled', enabled);
  }

  // Set master volume (0.0 to 1.0)
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('soundVolume', this.volume);
  }

  // Play a frequency-based sound effect
  playTone(frequency, duration, type = 'sine') {
    if (!this.enabled || !this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + duration
    );

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  // Card dealing sound (swish)
  cardDeal() {
    if (!this.enabled || !this.audioContext) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(this.volume * 0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  // Card shuffle sound
  cardShuffle() {
    if (!this.enabled || !this.audioContext) return;
    
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const frequency = 150 + Math.random() * 100;
        this.playTone(frequency, 0.05, 'sawtooth');
      }, i * 50);
    }
  }

  // Button click sound (subtle beep)
  buttonClick() {
    this.playTone(800, 0.05, 'sine');
  }

  // Hover sound (very subtle)
  buttonHover() {
    if (!this.enabled) return;
    this.playTone(600, 0.03, 'sine');
  }

  // Win sound (ascending tones)
  win() {
    if (!this.enabled || !this.audioContext) return;
    
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, index) => {
      setTimeout(() => {
        this.playTone(freq, 0.3, 'sine');
      }, index * 150);
    });
  }

  // Lose sound (descending tones)
  lose() {
    if (!this.enabled || !this.audioContext) return;
    
    const notes = [392, 349.23, 293.66]; // G4, F4, D4
    notes.forEach((freq, index) => {
      setTimeout(() => {
        this.playTone(freq, 0.4, 'triangle');
      }, index * 200);
    });
  }

  // Coin/credit sound
  coin() {
    if (!this.enabled || !this.audioContext) return;
    
    this.playTone(1000, 0.1, 'square');
    setTimeout(() => this.playTone(1200, 0.1, 'square'), 50);
  }

  // Jackpot/big win sound
  jackpot() {
    if (!this.enabled || !this.audioContext) return;
    
    const celebrationNotes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    celebrationNotes.forEach((freq, index) => {
      setTimeout(() => {
        this.playTone(freq, 0.2, 'sine');
      }, index * 100);
    });
  }

  // Roulette wheel spin sound
  rouletteSpin() {
    if (!this.enabled || !this.audioContext) return;
    
    let frequency = 100;
    const spinSound = setInterval(() => {
      this.playTone(frequency, 0.05, 'triangle');
      frequency += 20;
      if (frequency > 500) frequency = 100;
    }, 100);
    
    setTimeout(() => clearInterval(spinSound), 3000);
  }

  // Slot machine spin
  slotSpin() {
    if (!this.enabled || !this.audioContext) return;
    
    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        this.playTone(300 + (i * 10), 0.05, 'square');
      }, i * 50);
    }
  }

  // Error/invalid move sound
  error() {
    if (!this.enabled || !this.audioContext) return;
    
    this.playTone(200, 0.3, 'sawtooth');
  }

  // Notification sound
  notification() {
    this.playTone(800, 0.1, 'sine');
    setTimeout(() => this.playTone(1000, 0.1, 'sine'), 100);
  }

  // Dart throw sound
  dartThrow() {
    if (!this.enabled || !this.audioContext) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(this.volume * 0.4, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.2);
  }

  // Bullseye hit sound
  bullseye() {
    this.win(); // Reuse win sound for bullseye
  }

  // Chips/betting sound
  chipsBet() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.playTone(400 + (i * 50), 0.08, 'square');
      }, i * 60);
    }
  }
}

// Create singleton instance
const soundManager = new SoundManager();

// Load saved preferences
if (typeof window !== 'undefined') {
  const savedEnabled = localStorage.getItem('soundEnabled');
  const savedVolume = localStorage.getItem('soundVolume');
  
  if (savedEnabled !== null) {
    soundManager.setEnabled(savedEnabled === 'true');
  }
  
  if (savedVolume !== null) {
    soundManager.setVolume(parseFloat(savedVolume));
  }
}

export default soundManager;
