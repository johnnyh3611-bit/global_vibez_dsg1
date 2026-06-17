import React, { useRef, useEffect, useState } from 'react';

/**
 * Card Physics Engine
 * Canvas-based realistic card pitching with physics simulation
 */

class Card {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  suit: string;
  rank: string | number;
  width: number;
  height: number;
  gravity: number;
  friction: number;
  active: boolean;

  constructor(x: number, y: number, suit: string, rank: string | number) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.suit = suit;
    this.rank = rank;
    this.width = 60;
    this.height = 85;
    this.gravity = 0;
    this.friction = 0.98;
    this.active = true;
  }

  update() {
    if (!this.active) return;

    this.vx *= this.friction;
    this.vy *= this.friction;
    this.vy += this.gravity;
    
    this.x += this.vx;
    this.y += this.vy;
    
    this.rotation += this.rotationSpeed;
    this.rotationSpeed *= 0.98;

    // Deactivate when stopped
    if (Math.abs(this.vx) < 0.1 && Math.abs(this.vy) < 0.1 && Math.abs(this.rotationSpeed) < 0.01) {
      this.active = false;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Card shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    // Card background
    ctx.fillStyle = 'white';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-this.width / 2, -this.height / 2, this.width, this.height, 4);
    ctx.fill();
    ctx.stroke();

    // Card content
    ctx.shadowColor = 'transparent';
    
    const isRed = this.suit === '♥' || this.suit === '♦';
    ctx.fillStyle = isRed ? '#ef4444' : '#1f2937';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Rank
    ctx.fillText(this.rank, 0, -10);
    
    // Suit
    ctx.font = 'bold 20px Arial';
    ctx.fillText(this.suit, 0, 10);

    ctx.restore();
  }

  pitch(targetX, targetY, power = 8) {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    this.vx = (dx / distance) * power;
    this.vy = (dy / distance) * power;
    
    // Add stabilizing spin (like real dealers do)
    this.rotationSpeed = 0.15;
    this.active = true;
  }
}

export default function CardPhysicsEngine({ 
  width = 800, 
  height = 600,
  onCardLanded,
  dealerPosition = { x: 400, y: 100 },
  autoDemo = false
}) {
  const canvasRef = useRef(null);
  const [cards, setCards] = useState([]);
  const animationFrameRef = useRef(null);
  const cardsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let lastTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const deltaTime = (now - lastTime) / 16.67; // Normalize to 60fps
      lastTime = now;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw dealer position indicator
      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.beginPath();
      ctx.arc(dealerPosition.x, dealerPosition.y, 30, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DEALER', dealerPosition.x, dealerPosition.y);

      // Update and draw cards
      cardsRef.current.forEach(card => {
        card.update();
        card.draw(ctx);
      });

      // Remove inactive cards after delay
      cardsRef.current = cardsRef.current.filter(card => {
        if (!card.active && Date.now() - card.landedTime > 2000) {
          return false;
        }
        if (!card.active && !card.landedTime) {
          card.landedTime = Date.now();
          if (onCardLanded) onCardLanded(card);
        }
        return true;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [width, height, dealerPosition, onCardLanded]);

  useEffect(() => {
    if (autoDemo) {
      const interval = setInterval(() => {
        pitchCard();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [autoDemo]);

  const pitchCard = (targetX?: number, targetY?: number, suit?: string, rank?: string | number) => {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    const randomSuit = suit || suits[Math.floor(Math.random() * suits.length)];
    const randomRank = rank || ranks[Math.floor(Math.random() * ranks.length)];
    
    const card = new Card(
      dealerPosition.x,
      dealerPosition.y,
      randomSuit,
      randomRank
    );

    // Default target if not specified
    const finalTargetX = targetX ?? (200 + Math.random() * 400);
    const finalTargetY = targetY ?? (400 + Math.random() * 100);
    
    card.pitch(finalTargetX, finalTargetY);
    
    cardsRef.current.push(card);
    setCards([...cardsRef.current]);
    
    return card;
  };

  const clearCards = () => {
    cardsRef.current = [];
    setCards([]);
  };

  // Expose methods via ref
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.pitchCard = pitchCard;
      canvasRef.current.clearCards = clearCards;
    }
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="border border-gray-700 rounded-lg bg-gradient-to-br from-green-900 to-green-950"
      style={{ 
        width: '100%', 
        height: 'auto',
        maxWidth: `${width}px`,
        cursor: 'crosshair'
      }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const scaleX = width / rect.width;
        const scaleY = height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        pitchCard(x, y);
      }}
    />
  );
}
