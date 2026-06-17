// Social Features Validation Module for Dual-Bot Testing

class SocialFeaturesValidator {
  constructor(player1, player2) {
    this.player1 = player1;
    this.player2 = player2;
    this.violations = [];
  }

  logViolation(category, details) {
    console.log(`⚠️  SOCIAL FEATURE VIOLATION: ${category} - ${details}`);
    this.violations.push({ category, details, timestamp: new Date().toISOString() });
  }

  logSuccess(check) {
    console.log(`✅ SOCIAL FEATURE VERIFIED: ${check}`);
  }

  /**
   * Validate text chat functionality
   */
  async validateTextChat() {
    console.log('💬 Validating text chat...');
    
    // Check for chat input
    const p1ChatInput = await this.player1.locator('input[placeholder*="message"], textarea[placeholder*="chat"]').count();
    const p2ChatInput = await this.player2.locator('input[placeholder*="message"], textarea[placeholder*="chat"]').count();
    
    if (p1ChatInput > 0 && p2ChatInput > 0) {
      this.logSuccess('Chat input available for both players');
      return true;
    } else {
      console.log('ℹ️  Text chat not available');
      return false;
    }
  }

  /**
   * Test sending and receiving messages
   */
  async testMessageExchange() {
    console.log('📨 Testing message exchange...');
    
    try {
      const testMessage = `Test message ${Date.now()}`;
      
      // Player 1 sends message
      const p1Input = this.player1.locator('input[placeholder*="message"], textarea[placeholder*="chat"]').first();
      
      if (await p1Input.count() > 0) {
        await p1Input.fill(testMessage);
        await p1Input.press('Enter');
        
        console.log(`P1 sent: "${testMessage}"`);
        
        // Wait for message to appear
        await this.player1.waitForTimeout(2000);
        
        // Check if Player 2 received it
        const p2MessageVisible = await this.player2.locator(`text="${testMessage}"`).count();
        
        if (p2MessageVisible > 0) {
          this.logSuccess('Message successfully delivered to Player 2');
          return true;
        } else {
          this.logViolation('Message Delivery', 'P2 did not receive P1\'s message');
          return false;
        }
      } else {
        console.log('ℹ️  Chat input not available for testing');
        return false;
      }
    } catch (error) {
      console.log(`⚠️  Error testing message exchange: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate player presence indicators
   */
  async validatePresenceIndicators() {
    console.log('👥 Validating player presence...');
    
    // Check for online/offline indicators
    const p1Presence = await this.player1.locator('[class*="online"], [class*="presence"], .status-indicator').count();
    const p2Presence = await this.player2.locator('[class*="online"], [class*="presence"], .status-indicator').count();
    
    // Check for opponent name display or turn indicators
    const p1SeesOpponent = await this.player1.locator('text=/Opponent|Player 2|vs|YOUR TURN|Opponent\'s Turn/i').count();
    const p2SeesOpponent = await this.player2.locator('text=/Opponent|Player 1|vs|YOUR TURN|Opponent\'s Turn/i').count();
    
    console.log(`P1 sees opponent indicators: ${p1SeesOpponent}, P2 sees opponent indicators: ${p2SeesOpponent}`);
    
    if ((p1Presence > 0 || p1SeesOpponent > 0) && (p2Presence > 0 || p2SeesOpponent > 0)) {
      this.logSuccess('Both players see opponent presence');
      return true;
    } else if (p1SeesOpponent > 0 || p2SeesOpponent > 0) {
      this.logSuccess('Opponent presence visible through turn indicators');
      return true;
    } else {
      this.logViolation('Presence', 'Opponent presence not visible to one or both players');
      return false;
    }
  }

  /**
   * Validate real-time notifications
   */
  async validateNotifications(player, playerName) {
    console.log(`🔔 Checking notifications for ${playerName}...`);
    
    // Look for notification elements
    const notifications = await player.locator('[class*="notification"], [class*="toast"], [class*="alert"]').count();
    
    if (notifications > 0) {
      this.logSuccess(`Notifications present for ${playerName}`);
      return true;
    } else {
      console.log(`ℹ️  No notifications visible for ${playerName}`);
      return false;
    }
  }

  /**
   * Validate emoji/reaction support
   */
  async validateEmojis(player, playerName) {
    console.log(`😀 Checking emoji support for ${playerName}...`);
    
    // Look for emoji picker or reactions
    const emojiButton = await player.locator('button[aria-label*="emoji"], [class*="emoji-picker"]').count();
    const reactions = await player.locator('[class*="reaction"], [class*="emote"]').count();
    
    if (emojiButton > 0 || reactions > 0) {
      this.logSuccess(`Emoji/reaction support available for ${playerName}`);
      return true;
    } else {
      console.log(`ℹ️  No emoji support found for ${playerName}`);
      return false;
    }
  }

  /**
   * Validate friend/invite system
   */
  async validateFriendSystem(player, playerName) {
    console.log(`👫 Checking friend system for ${playerName}...`);
    
    // Look for friend-related UI
    const friendButton = await player.locator('button:has-text("Add Friend"), button:has-text("Invite")').count();
    const friendsList = await player.locator('[class*="friends"], [class*="contacts"]').count();
    
    if (friendButton > 0 || friendsList > 0) {
      this.logSuccess(`Friend system available for ${playerName}`);
      return true;
    } else {
      console.log(`ℹ️  Friend system not found for ${playerName}`);
      return false;
    }
  }

  /**
   * Validate lobby/matchmaking UI
   */
  async validateLobbyExperience() {
    console.log('🎮 Validating lobby experience...');
    
    // Check for player count display
    const p1PlayerCount = await this.player1.locator('text=/[0-9]+ player|online/i').count();
    const p2PlayerCount = await this.player2.locator('text=/[0-9]+ player|online/i').count();
    
    // Check for matchmaking status
    const p1Status = await this.player1.locator('text=/searching|matching|waiting/i').count();
    const p2Status = await this.player2.locator('text=/searching|matching|waiting/i').count();
    
    if (p1PlayerCount > 0 || p2PlayerCount > 0 || p1Status > 0 || p2Status > 0) {
      this.logSuccess('Lobby experience indicators present');
      return true;
    } else {
      console.log('ℹ️  Lobby indicators not visible (may be in game)');
      return false;
    }
  }

  /**
   * Validate profile visibility
   */
  async validateProfileDisplay(player, playerName) {
    console.log(`👤 Checking profile display for ${playerName}...`);
    
    // Look for profile elements
    const profilePic = await player.locator('img[alt*="profile"], [class*="avatar"]').count();
    const username = await player.locator('[class*="username"], [class*="player-name"]').count();
    const stats = await player.locator('[class*="stats"], [class*="score"]').count();
    
    if (profilePic > 0 || username > 0 || stats > 0) {
      this.logSuccess(`Profile elements visible for ${playerName}`);
      return true;
    } else {
      console.log(`ℹ️  Profile elements not found for ${playerName}`);
      return false;
    }
  }

  /**
   * Validate turn indicators and game state visibility
   */
  async validateGameStateVisibility() {
    console.log('📊 Validating game state visibility...');
    
    // Check for score display
    const p1Score = await this.player1.locator('text=/score|points/i').count();
    const p2Score = await this.player2.locator('text=/score|points/i').count();
    
    // Check for turn indicators (including emojis)
    const p1Turn = await this.player1.locator('text=/your turn|opponent|🎮|⏳/i').count();
    const p2Turn = await this.player2.locator('text=/your turn|opponent|🎮|⏳/i').count();
    
    // Check for game timer
    const p1Timer = await this.player1.locator('[class*="timer"], [class*="countdown"]').count();
    const p2Timer = await this.player2.locator('[class*="timer"], [class*="countdown"]').count();
    
    const totalIndicators = p1Score + p2Score + p1Turn + p2Turn + p1Timer + p2Timer;
    
    console.log(`Game state indicators found: Scores=${p1Score + p2Score}, Turns=${p1Turn + p2Turn}, Timers=${p1Timer + p2Timer}`);
    
    if (totalIndicators > 0) {
      this.logSuccess('Game state indicators visible to players');
      return true;
    } else {
      this.logViolation('Game State', 'Game state indicators missing');
      return false;
    }
  }

  /**
   * Validate spectator mode (if applicable)
   */
  async validateSpectatorMode(player, playerName) {
    console.log(`👀 Checking spectator mode for ${playerName}...`);
    
    // Look for spectator UI
    const spectatorIndicator = await player.locator('text=/spectating|watching/i').count();
    const viewerCount = await player.locator('text=/[0-9]+ viewer/i').count();
    
    if (spectatorIndicator > 0 || viewerCount > 0) {
      this.logSuccess(`Spectator mode active for ${playerName}`);
      return true;
    } else {
      console.log(`ℹ️  Spectator mode not active for ${playerName}`);
      return false;
    }
  }

  /**
   * Run all social feature validations
   */
  async runAllValidations() {
    console.log('\n👥 STARTING SOCIAL FEATURES VALIDATION');
    console.log('='.repeat(60));
    
    // Text chat
    const hasChatUI = await this.validateTextChat();
    if (hasChatUI) {
      await this.testMessageExchange();
    }
    
    // Presence & visibility
    await this.validatePresenceIndicators();
    await this.validateGameStateVisibility();
    
    // Profile display
    await this.validateProfileDisplay(this.player1, 'Player 1');
    await this.validateProfileDisplay(this.player2, 'Player 2');
    
    // Notifications & feedback
    await this.validateNotifications(this.player1, 'Player 1');
    await this.validateNotifications(this.player2, 'Player 2');
    
    // Optional features
    await this.validateEmojis(this.player1, 'Player 1');
    await this.validateFriendSystem(this.player1, 'Player 1');
    
    console.log('='.repeat(60));
    
    return this.violations.length === 0;
  }

  getSummary() {
    if (this.violations.length === 0) {
      return '✅ All social features validated successfully!';
    } else {
      return `❌ Found ${this.violations.length} social feature violations:\n` +
             this.violations.map((v, i) => `  ${i + 1}. ${v.category}: ${v.details}`).join('\n');
    }
  }
}

export { SocialFeaturesValidator };
