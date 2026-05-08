/**
 * GLOBAL VIBEZ ENGINE
 * The "Prescription" System Controller
 * Handles dealer personalities, game states, and premium UI interactions
 */

// ========================================
// DEALER PERSONALITIES - THE "HUMAN-AR" INTELLIGENCE
// ========================================
export const DEALER_PERSONALITIES = {
  NOVA: {
    id: "nova",
    name: "NOVA",
    title: "Lead Dealer",
    style: "Professional/Confident",
    auraColor: "rgba(255, 215, 0, 0.2)",
    accentPrimary: "#ffd700",
    accentSecondary: "#bf953f",
    
    // Contextual Reactions
    onWelcome: () => "Welcome to the inner circle. Let's see if the cards favor the bold tonight.",
    onBetPlaced: (amount) => `${amount > 100 ? 'Serious money' : 'Bets accepted'}. I like your confidence.`,
    onWin: (amt) => amt > 500 
      ? `Exquisite play. $${amt} added to your stack. You're on fire.`
      : `Clean sweep. $${amt} is yours.`,
    onLoss: () => "The house edge is a beast, but the night is young. Re-think your strategy.",
    onBigWin: (amt) => `Outstanding! $${amt}! The table remembers this moment.`,
    onBust: () => "Tough break. Even the best dealers can't control the cards.",
    onPush: () => "A push. Your chips stay where they are. Let's go again.",
    
    // Mood-based phrases
    celebrating: ["That's what I'm talking about!", "Now we're playing!", "Excellent execution!"],
    professional: ["Cards are honest, player.", "Let's keep this moving.", "House rules apply."],
    sympathetic: ["It happens to the best.", "Reset and reload.", "Next hand is yours."]
  },

  JADE: {
    id: "jade",
    name: "JADE",
    title: "Strategic Dealer",
    style: "Cool/Strategic",
    auraColor: "rgba(0, 255, 127, 0.2)",
    accentPrimary: "#00ff7f",
    accentSecondary: "#20c997",
    
    onWelcome: () => "Welcome. I've already calculated your odds. Let's see if you can beat them.",
    onBetPlaced: (amount) => `$${amount} on the table. Interesting choice.`,
    onWin: (amt) => `Calculated. I saw that move coming. $${amt} to you.`,
    onLoss: () => "Variance is a factor. Re-evaluate and go again.",
    onBigWin: (amt) => `Impressive. $${amt}. You're playing at 87% optimal strategy.`,
    onBust: () => "Probability caught up. Adjust your betting pattern.",
    onPush: () => "Neutral outcome. Variance evens out.",
    
    celebrating: ["Statistically improbable, but here we are.", "You beat the odds.", "Well executed."],
    professional: ["Focus on the math.", "Cards don't lie.", "Stick to your strategy."],
    sympathetic: ["Expected value catches everyone.", "Regroup.", "Next sequence starts now."]
  },

  ACE: {
    id: "ace",
    name: "ACE",
    title: "Precision Dealer",
    style: "Analytical/Precise",
    auraColor: "rgba(0, 212, 255, 0.2)",
    accentPrimary: "#00d4ff",
    accentSecondary: "#0891b2",
    
    onWelcome: () => "Table is set. Precision beats luck every time.",
    onBetPlaced: (amount) => `$${amount}. Recorded. Let's execute.`,
    onWin: (amt) => `Perfect execution. $${amt} awarded. Efficiency: 100%.`,
    onLoss: () => "Outcome logged. Recalibrate and continue.",
    onBigWin: (amt) => `Exceptional. $${amt}. Peak performance detected.`,
    onBust: () => "System variance. No errors on your end.",
    onPush: () => "Equilibrium maintained. Proceed.",
    
    celebrating: ["Optimal outcome achieved.", "Performance: Peak.", "Calculated perfection."],
    professional: ["Maintain focus.", "Execute the plan.", "Precision required."],
    sympathetic: ["Variance occurs.", "System reset.", "Recalibrate."]
  },

  RUBY: {
    id: "ruby",
    name: "RUBY",
    title: "Encouraging Dealer",
    style: "Warm/Encouraging",
    auraColor: "rgba(255, 0, 110, 0.2)",
    accentPrimary: "#ff006e",
    accentSecondary: "#c9184a",
    
    onWelcome: () => "Hey there, gorgeous! Ready to win big tonight? I can feel your energy!",
    onBetPlaced: (amount) => `$${amount}! I love your courage! Let's make magic happen!`,
    onWin: (amt) => `YES! $${amt} is all yours! I knew you had it in you!`,
    onLoss: () => "Oh honey, don't worry! Every champion has setbacks. You'll bounce back!",
    onBigWin: (amt) => `OH MY GOD! $${amt}!! You are UNSTOPPABLE! This is incredible!`,
    onBust: () => "It's okay, sweetheart. Shake it off. Your winning streak is coming!",
    onPush: () => "A tie! Keep that energy up, we're about to break through!",
    
    celebrating: ["You're amazing!", "I'm so proud!", "This is YOUR moment!"],
    professional: ["You've got this!", "Trust yourself!", "I believe in you!"],
    sympathetic: ["It's okay, darling.", "We all have tough hands.", "Tomorrow's a new game."]
  }
};

// ========================================
// GLOBAL VIBEZ ENGINE - SYSTEM CONTROLLER
// ========================================
class GlobalVibezEngine {
  constructor() {
    this.currentDealer = "NOVA"; // Default lead
    this.theme = "METAL_GOLD";
    this.walletBalance = 5000;
    this.gameState = "idle"; // idle, betting, playing, result
    this.initialized = false;
  }

  // Initialize the 'Prescription' Experience
  initExperience() {
    // console.log("🎰 Global Vibez Engine: Initializing...");
    // console.log(`👤 Lead Dealer: ${this.currentDealer}`);
    // console.log(`🎨 Theme: ${this.theme}`);
    // console.log(`💰 Wallet: $${this.walletBalance}`);
    
    // Load premium stylesheet
    this.loadPremiumStyles();
    
    // Set dealer-specific accent colors
    this.applyDealerTheme(this.currentDealer);
    
    this.initialized = true;
    // console.log("✅ Systems Online. Metal Shaders Loaded.");
    
    return this.getDealerGreeting();
  }

  // Load the Vibez Pro CSS
  loadPremiumStyles() {
    if (!document.querySelector('#vibez-pro-styles')) {
      const link = document.createElement('link');
      link.id = 'vibez-pro-styles';
      link.rel = 'stylesheet';
      link.href = '/src/styles/vibez-pro.css';
      document.head.appendChild(link);
    }
  }

  // Apply dealer-specific theme colors
  applyDealerTheme(dealerId) {
    const dealer = DEALER_PERSONALITIES[dealerId.toUpperCase()];
    if (!dealer) return;

    const root = document.documentElement;
    root.style.setProperty('--active-dealer-primary', dealer.accentPrimary);
    root.style.setProperty('--active-dealer-secondary', dealer.accentSecondary);
    root.style.setProperty('--active-dealer-glow', dealer.auraColor);
    
    this.currentDealer = dealerId.toUpperCase();
  }

  // Switch dealers
  switchDealer(newDealerId) {
    const dealer = DEALER_PERSONALITIES[newDealerId.toUpperCase()];
    if (!dealer) {
      // console.error(`Dealer ${newDealerId} not found`);
      return false;
    }

    // console.log(`🔄 Switching to ${dealer.name} - ${dealer.title}`);
    this.applyDealerTheme(newDealerId);
    
    // Update all action buttons
    this.updateActionButtons();
    
    return dealer.onWelcome();
  }

  // Get dealer greeting
  getDealerGreeting() {
    const dealer = DEALER_PERSONALITIES[this.currentDealer];
    return dealer.onWelcome();
  }

  // Handle betting action
  handleBet(amount, betType = "main") {
    if (amount > this.walletBalance) {
      const dealer = DEALER_PERSONALITIES[this.currentDealer];
      return {
        success: false,
        message: `${dealer.name}: "You're short at the table, friend. Visit the cage."`,
        balance: this.walletBalance
      };
    }

    this.gameState = "betting";
    this.walletBalance -= amount;

    // Trigger 'Action-Ready' pulse on metal buttons
    this.activateMetalButtons();

    const dealer = DEALER_PERSONALITIES[this.currentDealer];
    return {
      success: true,
      message: dealer.onBetPlaced(amount),
      balance: this.walletBalance,
      betAmount: amount
    };
  }

  // Handle game result
  handleResult(result) {
    const dealer = DEALER_PERSONALITIES[this.currentDealer];
    this.gameState = "result";

    let message = "";
    let mood = "professional";

    if (result.type === "win") {
      this.walletBalance += result.payout;
      message = result.payout > 500 
        ? dealer.onBigWin(result.payout)
        : dealer.onWin(result.payout);
      mood = "celebrating";
    } else if (result.type === "loss") {
      message = dealer.onLoss();
      mood = "sympathetic";
    } else if (result.type === "push") {
      message = dealer.onPush();
      mood = "professional";
    } else if (result.type === "bust") {
      message = dealer.onBust();
      mood = "sympathetic";
    }

    return {
      message,
      mood,
      balance: this.walletBalance,
      payout: result.payout || 0
    };
  }

  // Activate metal button animations
  activateMetalButtons() {
    const dealerClass = `action-ready-${this.currentDealer.toLowerCase()}`;
    document.querySelectorAll('.metal-button.action-button').forEach(btn => {
      // Remove all dealer classes first
      btn.classList.remove('action-ready-nova', 'action-ready-jade', 'action-ready-ace', 'action-ready-ruby');
      // Add current dealer class
      btn.classList.add(dealerClass);
    });
  }

  // Update action buttons to match dealer theme
  updateActionButtons() {
    this.activateMetalButtons();
  }

  // Get dealer-specific mood phrase
  getDealerMoodPhrase(mood = "professional") {
    const dealer = DEALER_PERSONALITIES[this.currentDealer];
    const phrases = dealer[mood] || dealer.professional;
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  // Play sound effect with dealer voice
  playDealerSound(soundType) {
    // Placeholder for audio integration
    // console.log(`🔊 ${this.currentDealer} Sound: ${soundType}`);
    // In production: soundManager.play(`${this.currentDealer}_${soundType}`);
  }

  // Get current state
  getState() {
    return {
      dealer: this.currentDealer,
      dealerInfo: DEALER_PERSONALITIES[this.currentDealer],
      balance: this.walletBalance,
      gameState: this.gameState,
      theme: this.theme
    };
  }
}

// ========================================
// SINGLETON INSTANCE
// ========================================
const vibezEngine = new GlobalVibezEngine();

// Auto-initialize on load
if (typeof window !== 'undefined') {
  window.GlobalVibezEngine = vibezEngine;
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      vibezEngine.initExperience();
    });
  } else {
    vibezEngine.initExperience();
  }
}

export default vibezEngine;
