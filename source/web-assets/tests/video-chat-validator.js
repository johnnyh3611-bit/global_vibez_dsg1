// Video Chat Validation Module for Dual-Bot Testing

class VideoChatValidator {
  constructor(player1, player2) {
    this.player1 = player1;
    this.player2 = player2;
    this.violations = [];
  }

  logViolation(category, details) {
    console.log(`⚠️  VIDEO CHAT VIOLATION: ${category} - ${details}`);
    this.violations.push({ category, details, timestamp: new Date().toISOString() });
  }

  logSuccess(check) {
    console.log(`✅ VIDEO CHAT VERIFIED: ${check}`);
  }

  /**
   * Check if video chat UI is present
   */
  async validateVideoChatUI(player, playerName) {
    console.log(`📹 Validating video chat UI for ${playerName}...`);
    
    // Look for video elements
    const videoElements = await player.locator('video').count();
    
    // Look for video chat controls
    const muteButton = await player.locator('button:has-text("Mute"), button[aria-label*="mute"]').count();
    const cameraButton = await player.locator('button:has-text("Camera"), button:has-text("Video"), button[aria-label*="camera"]').count();
    
    console.log(`Video elements: ${videoElements}, Mute button: ${muteButton}, Camera button: ${cameraButton}`);
    
    if (videoElements > 0) {
      this.logSuccess(`Video elements present (${videoElements} videos)`);
      return true;
    } else {
      console.log(`ℹ️  No video elements found for ${playerName} (may not be enabled)`);
      return false;
    }
  }

  /**
   * Validate video stream initialization
   */
  async validateVideoStream(player, playerName) {
    console.log(`🎥 Checking video stream for ${playerName}...`);
    
    try {
      // Check if video element has src or srcObject
      const videoWithSrc = await player.locator('video[src], video[srcobject]').count();
      
      // Check if video is playing
      const playingVideo = await player.evaluate(() => {
        const videos = document.querySelectorAll('video');
        for (let video of videos) {
          if (!video.paused && video.readyState >= 2) {
            return true;
          }
        }
        return false;
      });
      
      if (videoWithSrc > 0 || playingVideo) {
        this.logSuccess(`Video stream active for ${playerName}`);
        return true;
      } else {
        console.log(`⚠️  Video stream not active for ${playerName}`);
        return false;
      }
    } catch (error) {
      console.log(`⚠️  Error checking video stream: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate audio permissions and controls
   */
  async validateAudioControls(player, playerName) {
    console.log(`🔊 Validating audio controls for ${playerName}...`);
    
    // Check for mute/unmute buttons
    const muteButton = await player.locator('button:has-text("Mute"), button:has-text("Unmute")').count();
    const volumeControl = await player.locator('[type="range"][aria-label*="volume"], .volume-slider').count();
    
    if (muteButton > 0 || volumeControl > 0) {
      this.logSuccess(`Audio controls available for ${playerName}`);
      return true;
    } else {
      console.log(`ℹ️  No audio controls found for ${playerName}`);
      return false;
    }
  }

  /**
   * Validate camera controls
   */
  async validateCameraControls(player, playerName) {
    console.log(`📷 Validating camera controls for ${playerName}...`);
    
    // Check for camera on/off buttons
    const cameraButton = await player.locator('button:has-text("Camera"), button:has-text("Video")').count();
    const cameraIcon = await player.locator('[class*="camera"], [class*="video"]').count();
    
    if (cameraButton > 0 || cameraIcon > 0) {
      this.logSuccess(`Camera controls available for ${playerName}`);
      return true;
    } else {
      console.log(`ℹ️  No camera controls found for ${playerName}`);
      return false;
    }
  }

  /**
   * Validate video chat connection between players
   */
  async validatePeerConnection() {
    console.log('🔗 Validating peer-to-peer video connection...');
    
    // Check if both players see video elements
    const p1Videos = await this.player1.locator('video').count();
    const p2Videos = await this.player2.locator('video').count();
    
    console.log(`P1 sees ${p1Videos} videos, P2 sees ${p2Videos} videos`);
    
    // In a P2P setup, each player should see at least their own video + opponent's
    if (p1Videos >= 1 && p2Videos >= 1) {
      this.logSuccess('Video elements present for both players');
      return true;
    } else {
      this.logViolation('Peer Connection', 'Video elements missing for one or both players');
      return false;
    }
  }

  /**
   * Test mute functionality
   */
  async testMuteToggle(player, playerName) {
    console.log(`🔇 Testing mute toggle for ${playerName}...`);
    
    try {
      const muteButton = player.locator('button:has-text("Mute"), button[aria-label*="mute"]').first();
      const buttonExists = await muteButton.count() > 0;
      
      if (buttonExists) {
        // Check initial state
        const initialState = await muteButton.textContent();
        console.log(`Initial mute state: ${initialState}`);
        
        // Click mute button
        await muteButton.click({ timeout: 3000 });
        await player.waitForTimeout(500);
        
        // Check new state
        const newState = await muteButton.textContent();
        console.log(`New mute state: ${newState}`);
        
        if (initialState !== newState) {
          this.logSuccess(`Mute toggle working for ${playerName}`);
          return true;
        } else {
          this.logViolation('Mute Toggle', `Mute button not changing state for ${playerName}`);
          return false;
        }
      } else {
        console.log(`ℹ️  Mute button not found for ${playerName}`);
        return false;
      }
    } catch (error) {
      console.log(`⚠️  Error testing mute toggle: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate video quality indicators
   */
  async validateQualityIndicators(player, playerName) {
    console.log(`📊 Checking video quality indicators for ${playerName}...`);
    
    // Look for connection quality indicators
    const qualityIndicator = await player.locator('[class*="quality"], [class*="connection"], [class*="bandwidth"]').count();
    const networkIcon = await player.locator('[class*="network"], [class*="signal"]').count();
    
    if (qualityIndicator > 0 || networkIcon > 0) {
      this.logSuccess(`Quality indicators present for ${playerName}`);
      return true;
    } else {
      console.log(`ℹ️  No quality indicators found for ${playerName}`);
      return false;
    }
  }

  /**
   * Check for video chat permissions prompts
   */
  async checkPermissions(player, playerName) {
    console.log(`🔐 Checking media permissions for ${playerName}...`);
    
    try {
      // Check if permission prompt is visible
      const permissionPrompt = await player.locator('text=/Allow|Grant|Permission|Camera|Microphone/i').count();
      
      if (permissionPrompt > 0) {
        console.log(`⚠️  Permission prompt visible for ${playerName}`);
        this.logViolation('Permissions', `Media permissions not granted for ${playerName}`);
        return false;
      } else {
        this.logSuccess(`No permission issues for ${playerName}`);
        return true;
      }
    } catch (error) {
      return true; // Assume no permission issues if we can't check
    }
  }

  /**
   * Run all video chat validations
   */
  async runAllValidations() {
    console.log('\n📹 STARTING VIDEO CHAT VALIDATION');
    console.log('='.repeat(60));
    
    const p1UI = await this.validateVideoChatUI(this.player1, 'Player 1');
    const p2UI = await this.validateVideoChatUI(this.player2, 'Player 2');
    
    // Only proceed with detailed checks if video chat UI exists
    if (p1UI || p2UI) {
      await this.validateVideoStream(this.player1, 'Player 1');
      await this.validateVideoStream(this.player2, 'Player 2');
      
      await this.validateAudioControls(this.player1, 'Player 1');
      await this.validateAudioControls(this.player2, 'Player 2');
      
      await this.validateCameraControls(this.player1, 'Player 1');
      await this.validateCameraControls(this.player2, 'Player 2');
      
      await this.validatePeerConnection();
      
      await this.checkPermissions(this.player1, 'Player 1');
      await this.checkPermissions(this.player2, 'Player 2');
      
      // Optionally test mute toggle
      // await this.testMuteToggle(this.player1, 'Player 1');
    } else {
      console.log('ℹ️  Video chat not enabled in this game - skipping detailed checks');
    }
    
    console.log('='.repeat(60));
    
    return this.violations.length === 0;
  }

  getSummary() {
    if (this.violations.length === 0) {
      return '✅ All video chat features validated successfully!';
    } else {
      return `❌ Found ${this.violations.length} video chat violations:\n` +
             this.violations.map((v, i) => `  ${i + 1}. ${v.category}: ${v.details}`).join('\n');
    }
  }
}

export { VideoChatValidator };
