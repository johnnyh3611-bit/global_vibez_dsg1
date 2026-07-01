// Sound effects for Blackjack AAA
// Using Web Audio API for professional casino sounds

export class BlackjackSounds {
  constructor() {
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.sounds = {};
  }

  // Generate card dealing sound
  playCardDeal() {
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    
    oscillator.frequency.value = 200;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.1, this.context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);
    
    oscillator.start(this.context.currentTime);
    oscillator.stop(this.context.currentTime + 0.1);
  }

  // Generate chip placement sound
  playChipPlace() {
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.05, this.context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.05);
    
    oscillator.start(this.context.currentTime);
    oscillator.stop(this.context.currentTime + 0.05);
  }

  // Generate win sound
  playWin(isBlackjack = false) {
    const frequencies = isBlackjack ? [523, 659, 784, 1047] : [523, 659, 784];
    
    frequencies.forEach((freq, index) => {
      const oscillator = this.context.createOscillator();
      const gainNode = this.context.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.context.destination);
      
      oscillator.frequency.value = freq;
      oscillator.type = 'sine';
      
      const startTime = this.context.currentTime + (index * 0.1);
      gainNode.gain.setValueAtTime(0.2, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.3);
    });
  }

  // Generate loss sound
  playLoss() {
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    
    oscillator.frequency.value = 150;
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0.1, this.context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.5);
    
    oscillator.start(this.context.currentTime);
    oscillator.stop(this.context.currentTime + 0.5);
  }

  // Generate lightning sound
  playLightning() {
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.context.destination);
    
    oscillator.frequency.value = 100;
    oscillator.type = 'sawtooth';
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    
    gainNode.gain.setValueAtTime(0.3, this.context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.3);
    
    oscillator.start(this.context.currentTime);
    oscillator.stop(this.context.currentTime + 0.3);
  }

  // Generate side bet win sound
  playSideBetWin(multiplier) {
    const baseFreq = 600 + (multiplier * 10);
    
    for (let i = 0; i < 3; i++) {
      const oscillator = this.context.createOscillator();
      const gainNode = this.context.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.context.destination);
      
      oscillator.frequency.value = baseFreq + (i * 200);
      oscillator.type = 'sine';
      
      const startTime = this.context.currentTime + (i * 0.05);
      gainNode.gain.setValueAtTime(0.15, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.2);
    }
  }
}

export const soundManager = new BlackjackSounds();