/**
 * Universal Game Animations
 * Confetti, shake effects, and victory celebrations
 */

/**
 * Confetti Particle System
 */
export class ConfettiSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.animationFrame = null;
    this.active = false;
  }
  
  createParticle() {
    const colors = ['#22d3ee', '#fbbf24', '#f472b6', '#a78bfa', '#34d399', '#fb7185'];
    
    return {
      x: Math.random() * this.canvas.width,
      y: -10,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 2 + 3,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: Math.random() > 0.5 ? 'circle' : 'square',
      life: 1,
      decay: Math.random() * 0.005 + 0.002
    };
  }
  
  start(duration = 3000) {
    this.active = true;
    this.canvas.style.display = 'block';
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    
    // Create initial burst
    for (let i = 0; i < 100; i++) {
      this.particles.push(this.createParticle());
    }
    
    // Continue creating particles
    const interval = setInterval(() => {
      if (this.active) {
        for (let i = 0; i < 10; i++) {
          this.particles.push(this.createParticle());
        }
      }
    }, 100);
    
    // Stop after duration
    setTimeout(() => {
      this.active = false;
      clearInterval(interval);
      setTimeout(() => this.stop(), 2000);
    }, duration);
    
    this.animate();
  }
  
  animate() {
    if (!this.ctx) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Update and draw particles
    this.particles = this.particles.filter(particle => {
      // Physics
      particle.vy += 0.1; // Gravity
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.rotationSpeed;
      particle.life -= particle.decay;
      
      // Draw
      this.ctx.save();
      this.ctx.translate(particle.x, particle.y);
      this.ctx.rotate((particle.rotation * Math.PI) / 180);
      this.ctx.globalAlpha = particle.life;
      this.ctx.fillStyle = particle.color;
      
      if (particle.shape === 'circle') {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        this.ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
      }
      
      this.ctx.restore();
      
      // Remove if off screen or faded
      return particle.y < this.canvas.height + 10 && particle.life > 0;
    });
    
    if (this.particles.length > 0 || this.active) {
      this.animationFrame = requestAnimationFrame(() => this.animate());
    } else {
      this.stop();
    }
  }
  
  stop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.particles = [];
    this.active = false;
    this.canvas.style.display = 'none';
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

/**
 * Screen Shake Effect
 */
export const triggerScreenShake = (element, intensity = 'medium') => {
  const intensities = {
    light: { distance: 5, duration: 300 },
    medium: { distance: 10, duration: 500 },
    heavy: { distance: 20, duration: 700 }
  };
  
  const config = intensities[intensity] || intensities.medium;
  
  element.style.animation = `screen-shake-${intensity} ${config.duration}ms cubic-bezier(.36,.07,.19,.97) both`;
  
  setTimeout(() => {
    element.style.animation = '';
  }, config.duration);
};

/**
 * Pulse Glow Effect
 */
export const triggerPulseGlow = (element, color = '#22d3ee', duration = 1000) => {
  element.style.animation = `pulse-glow ${duration}ms ease-in-out`;
  element.style.setProperty('--glow-color', color);
  
  setTimeout(() => {
    element.style.animation = '';
  }, duration);
};

/**
 * Float Up Text Animation
 */
export const createFloatingText = (text, x, y, color = '#22d3ee') => {
  const textElement = document.createElement('div');
  textElement.className = 'floating-text';
  textElement.textContent = text;
  textElement.style.left = `${x}px`;
  textElement.style.top = `${y}px`;
  textElement.style.color = color;
  
  document.body.appendChild(textElement);
  
  setTimeout(() => {
    textElement.remove();
  }, 2000);
};

/**
 * Card Sparkle Effect
 */
export const triggerCardSparkle = (element) => {
  const sparkles = 8;
  
  for (let i = 0; i < sparkles; i++) {
    const sparkle = document.createElement('div');
    sparkle.className = 'card-sparkle';
    sparkle.style.left = '50%';
    sparkle.style.top = '50%';
    
    const angle = (i / sparkles) * Math.PI * 2;
    const distance = 30;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    
    sparkle.style.setProperty('--tx', `${x}px`);
    sparkle.style.setProperty('--ty', `${y}px`);
    
    element.appendChild(sparkle);
    
    setTimeout(() => sparkle.remove(), 1000);
  }
};

/**
 * Victory Fireworks
 */
export const triggerVictoryFireworks = (canvas) => {
  const ctx = canvas.getContext('2d');
  canvas.style.display = 'block';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const fireworks = [];
  const particles = [];
  
  class Firework {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = canvas.height;
      this.targetY = Math.random() * canvas.height * 0.4 + 50;
      this.vy = -8 - Math.random() * 4;
      this.color = `hsl(${Math.random() * 360}, 100%, 60%)`;
    }
    
    update() {
      this.y += this.vy;
      return this.y > this.targetY;
    }
    
    draw() {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    explode() {
      for (let i = 0; i < 30; i++) {
        particles.push(new Particle(this.x, this.y, this.color));
      }
    }
  }
  
  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 8;
      this.vy = (Math.random() - 0.5) * 8;
      this.life = 1;
      this.color = color;
    }
    
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.1;
      this.life -= 0.02;
      return this.life > 0;
    }
    
    draw() {
      ctx.globalAlpha = this.life;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  let frame = 0;
  const animate = () => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Launch new fireworks
    if (frame % 20 === 0 && fireworks.length < 3) {
      fireworks.push(new Firework());
    }
    
    // Update fireworks
    for (let i = fireworks.length - 1; i >= 0; i--) {
      fireworks[i].draw();
      if (!fireworks[i].update()) {
        fireworks[i].explode();
        fireworks.splice(i, 1);
      }
    }
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].draw();
      if (!particles[i].update()) {
        particles.splice(i, 1);
      }
    }
    
    frame++;
    
    if (frame < 200) {
      requestAnimationFrame(animate);
    } else {
      canvas.style.display = 'none';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
  
  animate();
};
