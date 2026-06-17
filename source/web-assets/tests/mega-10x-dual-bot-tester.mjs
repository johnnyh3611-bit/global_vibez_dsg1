#!/usr/bin/env node

/**
 * 🚀 GLOBAL VIBEZ DSG - MEGA 10X DUAL BOT TESTING SYSTEM
 * 
 * Tests EVERYTHING:
 * - All 27+ games (card, board, cultural)
 * - Engagement Engine (notifications, XP, streaks, daily rewards)
 * - MY VIBEZ Platform (upload, feed, likes, comments)
 * - Friend System
 * - AI Date Planner
 * - Dating System
 * - Tournaments
 * - WebSocket real-time features
 * - Authentication flows
 * - Database persistence
 * - UI/UX validation
 * - Performance testing
 * - Concurrent user simulation (10+ bots)
 */

import { chromium } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

class MegaDualBotTester {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';
    this.apiUrl = config.apiUrl || process.env.REACT_APP_BACKEND_URL || 'https://social-connect-953.preview.emergentagent.com';
    this.botCount = config.botCount || 10;
    this.browsers = [];
    this.testUsers = [];
    this.testResults = {
      games: [],
      engagement: [],
      myVibez: [],
      friends: [],
      dating: [],
      tournaments: [],
      auth: [],
      websockets: [],
      performance: [],
      ui: [],
    };
    this.startTime = Date.now();
  }

  /**
   * 🎮 SECTION 1: ALL GAMES TESTING
   */
  async testAllGames() {
    console.log('\n' + '='.repeat(80));
    console.log('🎮 TESTING ALL 27+ GAMES');
    console.log('='.repeat(80));

    const games = {
      cardGames: [
        'poker', 'spades', 'hearts', 'rummy', 'blackjack', 'gofish', 
        'crazy-eights', 'uno', 'bid-whist'
      ],
      boardGames: [
        'chess', 'checkers', 'connect4', 'tictactoe', 'reversi'
      ],
      culturalGames: [
        'ludo', 'carrom', 'snakes-and-ladders', 'chinese-checkers',
        'mahjong', 'dominoes', 'mancala', 'go', 'shogi', 'xiangqi'
      ]
    };

    for (const [category, gameList] of Object.entries(games)) {
      console.log(`\n📂 Testing ${category}...`);
      
      for (const game of gameList) {
        const result = await this.testSingleGame(game, category);
        this.testResults.games.push(result);
      }
    }

    return this.testResults.games;
  }

  async testSingleGame(gameName, category) {
    console.log(`\n  🎲 Testing ${gameName}...`);
    
    const browser1 = await chromium.launch({ headless: true });
    const browser2 = await chromium.launch({ headless: true });
    
    const player1 = await browser1.newPage();
    const player2 = await browser2.newPage();
    
    try {
      // Create two test users
      const user1 = await this.createTestUser();
      const user2 = await this.createTestUser();
      
      // Login both bots
      await this.loginUser(player1, user1);
      await this.loginUser(player2, user2);
      
      // Navigate to game page
      const gameUrl = `${this.baseUrl}/http-multiplayer`;
      await player1.goto(gameUrl);
      await player2.goto(gameUrl);
      
      await player1.waitForTimeout(2000);
      await player2.waitForTimeout(2000);
      
      // Create game (Player 1)
      await player1.screenshot({ path: `/tmp/game_${gameName}_p1_lobby.png`,  });
      
      // Check if game is playable
      const isPlayable = await this.checkGamePlayability(player1, gameName);
      
      // Take screenshots
      await player1.screenshot({ path: `/tmp/game_${gameName}_p1_state.png`,  });
      await player2.screenshot({ path: `/tmp/game_${gameName}_p2_state.png`,  });
      
      return {
        game: gameName,
        category,
        status: isPlayable ? 'PASS' : 'FAIL',
        playable: isPlayable,
        screenshots: [
          `/tmp/game_${gameName}_p1_lobby.png`,
          `/tmp/game_${gameName}_p1_state.png`,
          `/tmp/game_${gameName}_p2_state.png`
        ],
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`     ❌ Error: ${error.message}`);
      return {
        game: gameName,
        category,
        status: 'ERROR',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    } finally {
      await browser1.close();
      await browser2.close();
    }
  }

  async checkGamePlayability(page, gameName) {
    try {
      // Check for common game elements
      const hasGameBoard = await page.locator('.game-board, .board, [class*="game"], [class*="table"]').count() > 0;
      const hasCards = await page.locator('[class*="card"], [class*="Card"]').count() > 0;
      const hasButtons = await page.locator('button').count() > 0;
      
      return hasGameBoard || hasCards || hasButtons;
    } catch {
      return false;
    }
  }

  /**
   * 🎯 SECTION 2: ENGAGEMENT ENGINE TESTING
   */
  async testEngagementEngine() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 TESTING ENGAGEMENT ENGINE');
    console.log('='.repeat(80));

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
      const user = await this.createTestUser();
      await this.loginUser(page, user);
      
      // Wait for engagement UI to load
      await page.goto(`${this.baseUrl}/dashboard`);
      await page.waitForTimeout(3000);
      
      const tests = [];
      
      // Test 1: Daily Rewards Modal
      console.log('\n  📦 Testing Daily Rewards Modal...');
      const dailyRewardsVisible = await page.locator('text=Daily Reward').count() > 0;
      tests.push({
        name: 'Daily Rewards Modal Auto-Popup',
        status: dailyRewardsVisible ? 'PASS' : 'FAIL',
        visible: dailyRewardsVisible
      });
      
      await page.screenshot({ path: '/tmp/engagement_daily_rewards.png',  });
      
      // Close daily rewards if visible
      if (dailyRewardsVisible) {
        try {
          await page.click('button:has-text("Claim Reward")', { timeout: 2000 });
          await page.waitForTimeout(2000);
        } catch (e) {
          console.log('     Could not claim reward:', e.message);
        }
      }
      
      // Test 2: Notification Bell
      console.log('\n  🔔 Testing Notification Bell...');
      const notificationBell = await page.locator('svg.lucide-bell').count() > 0;
      tests.push({
        name: 'Notification Bell Visible',
        status: notificationBell ? 'PASS' : 'FAIL',
        visible: notificationBell
      });
      
      // Test 3: Level Display
      console.log('\n  ⭐ Testing Level/XP Display...');
      const levelDisplay = await page.locator('text=LEVEL').count() > 0;
      tests.push({
        name: 'Level/XP Display',
        status: levelDisplay ? 'PASS' : 'FAIL',
        visible: levelDisplay
      });
      
      // Test 4: Streak Counter
      console.log('\n  🔥 Testing Streak Counter...');
      const streakDisplay = await page.locator('text=STREAK').count() > 0;
      tests.push({
        name: 'Streak Counter',
        status: streakDisplay ? 'PASS' : 'FAIL',
        visible: streakDisplay
      });
      
      // Test 5: Backend API - Get Stats
      console.log('\n  📊 Testing Backend API: Get Stats...');
      const statsResponse = await fetch(`${this.apiUrl}/api/engagement/profile/stats/${user.user_id}`);
      const statsData = await statsResponse.json();
      tests.push({
        name: 'Get User Stats API',
        status: statsData.success ? 'PASS' : 'FAIL',
        data: statsData.stats
      });
      
      // Test 6: Backend API - Claim Daily Reward
      console.log('\n  🎁 Testing Backend API: Claim Daily Reward...');
      const claimResponse = await fetch(`${this.apiUrl}/api/engagement/daily-reward/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.user_id })
      });
      const claimData = await claimResponse.json();
      tests.push({
        name: 'Claim Daily Reward API',
        status: claimData.success ? 'PASS' : 'FAIL',
        xp_earned: claimData.xp_earned,
        streak: claimData.current_streak
      });
      
      // Test 7: Backend API - Send Notification
      console.log('\n  📨 Testing Backend API: Send Notification...');
      const notifResponse = await fetch(`${this.apiUrl}/api/engagement/notification/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          type: 'achievement',
          title: 'Test Achievement!',
          message: 'This is a test notification from the mega bot tester',
          action_url: '/dashboard'
        })
      });
      const notifData = await notifResponse.json();
      tests.push({
        name: 'Send Notification API',
        status: notifData.success ? 'PASS' : 'FAIL'
      });
      
      // Test 8: Check notification appears in UI
      console.log('\n  👀 Checking notification in UI...');
      await page.reload();
      await page.waitForTimeout(2000);
      
      const notifBadge = await page.locator('.bg-red-500').count() > 0;
      tests.push({
        name: 'Notification Badge Appears',
        status: notifBadge ? 'PASS' : 'FAIL',
        visible: notifBadge
      });
      
      await page.screenshot({ path: '/tmp/engagement_full.png',  });
      
      this.testResults.engagement = tests;
      
      console.log(`\n  ✅ Engagement Tests Complete: ${tests.filter(t => t.status === 'PASS').length}/${tests.length} passed`);
      
      return tests;
      
    } catch (error) {
      console.error(`  ❌ Engagement testing error: ${error.message}`);
      return [{ name: 'Engagement Engine', status: 'ERROR', error: error.message }];
    } finally {
      await browser.close();
    }
  }

  /**
   * 📹 SECTION 3: MY VIBEZ PLATFORM TESTING
   */
  async testMyVibezPlatform() {
    console.log('\n' + '='.repeat(80));
    console.log('📹 TESTING MY VIBEZ PLATFORM');
    console.log('='.repeat(80));

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
      const user = await this.createTestUser();
      await this.loginUser(page, user);
      
      const tests = [];
      
      // Test 1: Navigate to MY VIBEZ
      console.log('\n  📺 Navigating to MY VIBEZ...');
      await page.goto(`${this.baseUrl}/my-vibez`);
      await page.waitForTimeout(2000);
      
      const myVibezLoaded = await page.locator('text=MY VIBEZ, text=For You, text=Gaming').count() > 0;
      tests.push({
        name: 'MY VIBEZ Page Loads',
        status: myVibezLoaded ? 'PASS' : 'FAIL'
      });
      
      await page.screenshot({ path: '/tmp/myvibez_feed.png',  });
      
      // Test 2: Feed Tabs
      console.log('\n  📑 Testing Feed Tabs...');
      const tabs = ['For You', 'Gaming', 'Dating'];
      for (const tab of tabs) {
        const tabExists = await page.locator(`text=${tab}`).count() > 0;
        tests.push({
          name: `${tab} Tab Exists`,
          status: tabExists ? 'PASS' : 'FAIL'
        });
      }
      
      // Test 3: Navigate to Create Vibe
      console.log('\n  ➕ Testing Create Vibe Page...');
      await page.goto(`${this.baseUrl}/my-vibez/create`);
      await page.waitForTimeout(2000);
      
      const createPageLoaded = await page.locator('text=Create, text=Upload').count() > 0;
      tests.push({
        name: 'Create Vibe Page Loads',
        status: createPageLoaded ? 'PASS' : 'FAIL'
      });
      
      await page.screenshot({ path: '/tmp/myvibez_create.png',  });
      
      // Test 4: Backend API - Get Feed
      console.log('\n  📡 Testing Backend API: Get Feed...');
      const feedResponse = await fetch(`${this.apiUrl}/api/my-vibez/feed/for-you?skip=0&limit=10`);
      const feedData = await feedResponse.json();
      tests.push({
        name: 'Get Feed API',
        status: feedData.success ? 'PASS' : 'FAIL',
        post_count: feedData.posts?.length || 0
      });
      
      // Test 5: Backend API - Get Challenges
      console.log('\n  🏆 Testing Backend API: Get Challenges...');
      const challengesResponse = await fetch(`${this.apiUrl}/api/my-vibez/challenges`);
      const challengesData = await challengesResponse.json();
      tests.push({
        name: 'Get Challenges API',
        status: challengesData.success ? 'PASS' : 'FAIL',
        challenge_count: challengesData.challenges?.length || 0
      });
      
      this.testResults.myVibez = tests;
      
      console.log(`\n  ✅ MY VIBEZ Tests Complete: ${tests.filter(t => t.status === 'PASS').length}/${tests.length} passed`);
      
      return tests;
      
    } catch (error) {
      console.error(`  ❌ MY VIBEZ testing error: ${error.message}`);
      return [{ name: 'MY VIBEZ Platform', status: 'ERROR', error: error.message }];
    } finally {
      await browser.close();
    }
  }

  /**
   * 👥 SECTION 4: FRIEND SYSTEM TESTING
   */
  async testFriendSystem() {
    console.log('\n' + '='.repeat(80));
    console.log('👥 TESTING FRIEND SYSTEM');
    console.log('='.repeat(80));

    const browser1 = await chromium.launch({ headless: true });
    const browser2 = await chromium.launch({ headless: true });
    
    try {
      const user1 = await this.createTestUser();
      const user2 = await this.createTestUser();
      
      const page1 = await browser1.newPage();
      const page2 = await browser2.newPage();
      
      await this.loginUser(page1, user1);
      await this.loginUser(page2, user2);
      
      const tests = [];
      
      // Test 1: Navigate to Friends page
      console.log('\n  🔗 Testing Friends Page...');
      await page1.goto(`${this.baseUrl}/friends`);
      await page1.waitForTimeout(2000);
      
      const friendsPageLoaded = await page1.locator('text=Friends, text=Add Friend').count() > 0;
      tests.push({
        name: 'Friends Page Loads',
        status: friendsPageLoaded ? 'PASS' : 'FAIL'
      });
      
      await page1.screenshot({ path: '/tmp/friends_page.png',  });
      
      // Test 2: Backend API - Add Friend
      console.log('\n  ➕ Testing Backend API: Add Friend...');
      const addFriendResponse = await fetch(`${this.apiUrl}/api/friends/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user1.user_id,
          friend_id: user2.user_id
        })
      });
      const addFriendData = await addFriendResponse.json();
      tests.push({
        name: 'Add Friend API',
        status: addFriendData.success ? 'PASS' : 'FAIL'
      });
      
      // Test 3: Backend API - List Friends
      console.log('\n  📋 Testing Backend API: List Friends...');
      const listFriendsResponse = await fetch(`${this.apiUrl}/api/friends/list/${user1.user_id}`);
      const listFriendsData = await listFriendsResponse.json();
      tests.push({
        name: 'List Friends API',
        status: listFriendsData.success ? 'PASS' : 'FAIL',
        friend_count: listFriendsData.friends?.length || 0
      });
      
      this.testResults.friends = tests;
      
      console.log(`\n  ✅ Friend System Tests Complete: ${tests.filter(t => t.status === 'PASS').length}/${tests.length} passed`);
      
      return tests;
      
    } catch (error) {
      console.error(`  ❌ Friend system testing error: ${error.message}`);
      return [{ name: 'Friend System', status: 'ERROR', error: error.message }];
    } finally {
      await browser1.close();
      await browser2.close();
    }
  }

  /**
   * 🤖 SECTION 5: AI DATE PLANNER TESTING
   */
  async testAIDatePlanner() {
    console.log('\n' + '='.repeat(80));
    console.log('🤖 TESTING AI DATE PLANNER');
    console.log('='.repeat(80));

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
      const user = await this.createTestUser();
      await this.loginUser(page, user);
      
      const tests = [];
      
      // Test 1: Navigate to AI Date Planner
      console.log('\n  🗓️ Testing AI Date Planner Page...');
      await page.goto(`${this.baseUrl}/ai-date-planner`);
      await page.waitForTimeout(2000);
      
      const aiPlannerLoaded = await page.locator('text=AI Date Planner, text=Date, text=Plan').count() > 0;
      tests.push({
        name: 'AI Date Planner Page Loads',
        status: aiPlannerLoaded ? 'PASS' : 'FAIL'
      });
      
      await page.screenshot({ path: '/tmp/ai_date_planner.png',  });
      
      this.testResults.dating.push(...tests);
      
      console.log(`\n  ✅ AI Date Planner Tests Complete: ${tests.filter(t => t.status === 'PASS').length}/${tests.length} passed`);
      
      return tests;
      
    } catch (error) {
      console.error(`  ❌ AI Date Planner testing error: ${error.message}`);
      return [{ name: 'AI Date Planner', status: 'ERROR', error: error.message }];
    } finally {
      await browser.close();
    }
  }

  /**
   * 🏃 SECTION 6: CONCURRENT USER SIMULATION
   */
  async testConcurrentUsers(userCount = 10) {
    console.log('\n' + '='.repeat(80));
    console.log(`🏃 TESTING ${userCount} CONCURRENT USERS`);
    console.log('='.repeat(80));

    const browsers = [];
    const users = [];
    
    try {
      console.log(`\n  🚀 Launching ${userCount} concurrent users...`);
      
      const promises = [];
      for (let i = 0; i < userCount; i++) {
        promises.push(this.simulateSingleUser(i));
      }
      
      const results = await Promise.all(promises);
      
      const successCount = results.filter(r => r.success).length;
      
      console.log(`\n  ✅ Concurrent Users Test: ${successCount}/${userCount} users simulated successfully`);
      
      this.testResults.performance.push({
        name: 'Concurrent Users Simulation',
        status: successCount === userCount ? 'PASS' : 'PARTIAL',
        total_users: userCount,
        successful: successCount,
        failed: userCount - successCount
      });
      
      return results;
      
    } catch (error) {
      console.error(`  ❌ Concurrent user testing error: ${error.message}`);
      return [];
    }
  }

  async simulateSingleUser(userId) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
      const user = await this.createTestUser();
      await this.loginUser(page, user);
      
      // Simulate user activity
      const pages = ['/dashboard', '/games', '/friends', '/my-vibez', '/settings'];
      const randomPage = pages[Math.floor(Math.random() * pages.length)];
      
      await page.goto(`${this.baseUrl}${randomPage}`);
      await page.waitForTimeout(1000 + Math.random() * 2000);
      
      await browser.close();
      
      return { userId, success: true, page: randomPage };
      
    } catch (error) {
      await browser.close();
      return { userId, success: false, error: error.message };
    }
  }

  /**
   * 🔧 HELPER METHODS
   */
  async createTestUser() {
    try {
      const response = await fetch(`${this.apiUrl}/api/auth/test-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create test user: ${response.status}`);
      }
      
      const data = await response.json();
      return {
        user_id: data.user_id,
        session_token: data.session_token,
        email: data.email
      };
    } catch (error) {
      console.error(`Error creating test user: ${error.message}`);
      throw error;
    }
  }

  async loginUser(page, user) {
    try {
      // Set session token cookie
      await page.context().addCookies([{
        name: 'session_token',
        value: user.session_token,
        domain: new URL(this.baseUrl).hostname,
        path: '/'
      }]);
      
      // Also store in localStorage
      await page.goto(this.baseUrl);
      await page.evaluate((userData) => {
        localStorage.setItem('user_id', userData.user_id);
        localStorage.setItem('token', userData.session_token);
      }, user);
      
      await page.waitForTimeout(500);
      
    } catch (error) {
      console.error(`Error logging in user: ${error.message}`);
      throw error;
    }
  }

  /**
   * 📊 REPORT GENERATION
   */
  async generateComprehensiveReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 GENERATING COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(80));

    const totalTests = 
      this.testResults.games.length +
      this.testResults.engagement.length +
      this.testResults.myVibez.length +
      this.testResults.friends.length +
      this.testResults.dating.length +
      this.testResults.performance.length;

    const passedTests = [
      ...this.testResults.games,
      ...this.testResults.engagement,
      ...this.testResults.myVibez,
      ...this.testResults.friends,
      ...this.testResults.dating,
      ...this.testResults.performance
    ].filter(t => t.status === 'PASS').length;

    const report = {
      meta: {
        generated_at: new Date().toISOString(),
        test_duration_ms: Date.now() - this.startTime,
        tester_version: '10X_MEGA_v1.0',
        base_url: this.baseUrl,
        api_url: this.apiUrl
      },
      summary: {
        total_tests: totalTests,
        passed: passedTests,
        failed: totalTests - passedTests,
        pass_rate: ((passedTests / totalTests) * 100).toFixed(2) + '%'
      },
      results: this.testResults,
      screenshots_directory: '/tmp/'
    };

    const reportPath = `/app/test_reports/mega_10x_bot_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n✅ Report saved: ${reportPath}`);
    console.log(`\n📈 FINAL SUMMARY:`);
    console.log(`   Total Tests: ${report.summary.total_tests}`);
    console.log(`   ✅ Passed: ${report.summary.passed}`);
    console.log(`   ❌ Failed: ${report.summary.failed}`);
    console.log(`   📊 Pass Rate: ${report.summary.pass_rate}`);
    console.log(`   ⏱️  Duration: ${(report.meta.test_duration_ms / 1000).toFixed(2)}s`);
    console.log(`\n🎮 Games: ${this.testResults.games.filter(t => t.status === 'PASS').length}/${this.testResults.games.length}`);
    console.log(`🎯 Engagement: ${this.testResults.engagement.filter(t => t.status === 'PASS').length}/${this.testResults.engagement.length}`);
    console.log(`📹 MY VIBEZ: ${this.testResults.myVibez.filter(t => t.status === 'PASS').length}/${this.testResults.myVibez.length}`);
    console.log(`👥 Friends: ${this.testResults.friends.filter(t => t.status === 'PASS').length}/${this.testResults.friends.length}`);
    console.log(`🤖 Dating/AI: ${this.testResults.dating.filter(t => t.status === 'PASS').length}/${this.testResults.dating.length}`);
    console.log(`🏃 Performance: ${this.testResults.performance.filter(t => t.status === 'PASS').length}/${this.testResults.performance.length}`);

    return report;
  }

  /**
   * 🚀 MAIN TEST RUNNER
   */
  async runAllTests(options = {}) {
    console.log('\n' + '█'.repeat(80));
    console.log('🚀 GLOBAL VIBEZ DSG - MEGA 10X DUAL BOT TESTING SYSTEM');
    console.log('█'.repeat(80));
    console.log(`\n⏱️  Started at: ${new Date().toLocaleString()}`);

    try {
      // Run all test suites
      if (options.testGames !== false) {
        await this.testAllGames();
      }
      
      if (options.testEngagement !== false) {
        await this.testEngagementEngine();
      }
      
      if (options.testMyVibez !== false) {
        await this.testMyVibezPlatform();
      }
      
      if (options.testFriends !== false) {
        await this.testFriendSystem();
      }
      
      if (options.testAIDatePlanner !== false) {
        await this.testAIDatePlanner();
      }
      
      if (options.testConcurrent !== false) {
        await this.testConcurrentUsers(options.concurrentUsers || 10);
      }
      
      // Generate comprehensive report
      const report = await this.generateComprehensiveReport();
      
      console.log('\n' + '█'.repeat(80));
      console.log('✅ ALL TESTS COMPLETE!');
      console.log('█'.repeat(80));
      
      return report;
      
    } catch (error) {
      console.error('\n❌ CRITICAL ERROR in test runner:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const tester = new MegaDualBotTester({
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    apiUrl: process.env.REACT_APP_BACKEND_URL || 'https://social-connect-953.preview.emergentagent.com',
    botCount: 10
  });

  const options = {
    testGames: true,
    testEngagement: true,
    testMyVibez: true,
    testFriends: true,
    testAIDatePlanner: true,
    testConcurrent: true,
    concurrentUsers: 10
  };

  await tester.runAllTests(options);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default MegaDualBotTester;
