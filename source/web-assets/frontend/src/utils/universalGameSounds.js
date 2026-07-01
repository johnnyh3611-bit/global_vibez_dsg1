/**
 * Universal Game Sound Manager
 * Handles all audio for the Universal Card Game Engine
 * Uses Web Audio API for precise timing and mixing
 */

class UniversalGameSounds {
  constructor() {
    this.enabled = true;
    this.volume = 0.7;
    this.sounds = {};
    
    // Initialize audio context
    this.audioContext = null;
    this.initAudioContext();
  }
  
  initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
      this.enabled = false;
    }
  }
  
  // Resume audio context (required after user interaction)
  async resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
  
  /**
   * Generate card flip sound using oscillators
   */
  playCardFlip() {
    if (!this.enabled || !this.audioContext) return;
    
    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Sharp "flip" sound
    oscillator.frequency.setValueAtTime(800, now);
    oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.1);
    
    gainNode.gain.setValueAtTime(this.volume * 0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    oscillator.start(now);
    oscillator.stop(now + 0.15);
  }
  
  /**
   * Generate card slide/deal sound
   */
  playCardSlide() {
    if (!this.enabled || !this.audioContext) return;
    
    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Swoosh sound
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(400, now);
    oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.2);
    
    gainNode.gain.setValueAtTime(this.volume * 0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }
  
  /**
   * Generate chip placement sound
   */
  playChipPlace() {
    if (!this.enabled || !this.audioContext) return;
    
    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Clink sound
    oscillator.frequency.setValueAtTime(1200, now);
    oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.05);
    
    gainNode.gain.setValueAtTime(this.volume * 0.4, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  }
  
  /**
   * Generate button click sound
   */
  playButtonClick() {
    if (!this.enabled || !this.audioContext) return;
    
    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(600, now);
    oscillator.frequency.exponentialRampToValueAtTime(300, now + 0.05);
    
    gainNode.gain.setValueAtTime(this.volume * 0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    
    oscillator.start(now);
    oscillator.stop(now + 0.08);
  }
  
  /**
   * Generate win celebration sound
   */
  playWin() {
    if (!this.enabled || !this.audioContext) return;
    
    const now = this.audioContext.currentTime;
    
    // Triumphant ascending chord
    const frequencies = [523.25, 659.25, 783.99]; // C, E, G
    
    frequencies.forEach((freq, index) => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.frequency.setValueAtTime(freq, now + index * 0.1);
      
      gainNode.gain.setValueAtTime(0, now + index * 0.1);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, now + index * 0.1 + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + index * 0.1 + 0.5);
      
      oscillator.start(now + index * 0.1);
      oscillator.stop(now + index * 0.1 + 0.5);
    });
  }
  
  /**
   * Generate blackjack celebration (special win)
   */
  playBlackjack() {
    if (!this.enabled || !this.audioContext) return;
    
    const now = this.audioContext.currentTime;
    
    // Dramatic ascending fanfare
    const frequencies = [440, 554.37, 659.25, 880]; // A, C#, E, A
    
    frequencies.forEach((freq, index) => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, now + index * 0.08);
      
      gainNode.gain.setValueAtTime(0, now + index * 0.08);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.4, now + index * 0.08 + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + index * 0.08 + 0.6);
      
      oscillator.start(now + index * 0.08);
      oscillator.stop(now + index * 0.08 + 0.6);
    });
  }
  
  /**
   * Generate loss sound
   */
  playLoss() {
    if (!this.enabled || !this.audioContext) return;
    
    const now = this.audioContext.currentTime;
    
    // Descending "aww" sound
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, now);
    oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.5);
    
    gainNode.gain.setValueAtTime(this.volume * 0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    
    oscillator.start(now);
    oscillator.stop(now + 0.5);
  }
  
  /**
   * Generate push/tie sound
   */
  playPush() {
    if (!this.enabled || !this.audioContext) return;
    
    const now = this.audioContext.currentTime;
    
    // Neutral "beep"
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(440, now);
    
    gainNode.gain.setValueAtTime(this.volume * 0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    oscillator.start(now);
    oscillator.stop(now + 0.3);
  }
  
  /**
   * Generate bust sound
   */
  playBust() {
    if (!this.enabled || !this.audioContext) return;
    
    const now = this.audioContext.currentTime;
    
    // Harsh descending buzz
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(300, now);
    oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.4);
    
    gainNode.gain.setValueAtTime(this.volume * 0.25, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    
    oscillator.start(now);
    oscillator.stop(now + 0.4);
  }
  
  /**
   * Toggle sound on/off
   */
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
  
  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(level) {
    this.volume = Math.max(0, Math.min(1, level));
  }
}

// Create singleton instance
const universalGameSounds = new UniversalGameSounds();

export default universalGameSounds;
