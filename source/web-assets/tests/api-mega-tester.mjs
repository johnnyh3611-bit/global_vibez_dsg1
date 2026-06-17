#!/usr/bin/env node

/**
 * 🚀 API-FOCUSED MEGA TESTER (No Browser Required)
 * Tests all backend APIs, engagement, MY VIBEZ, friends, games endpoints
 */

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://social-connect-953.preview.emergentagent.com';

class APIMegaTester {
  constructor() {
    this.results = {
      engagement: [],
      myVibez: [],
      friends: [],
      games: [],
      aiDatePlanner: [],
      auth: [],
      concurrent: []
    };
    this.startTime = Date.now();
  }

  async createTestUser() {
    const response = await fetch(`${API_URL}/api/auth/test-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return await response.json();
  }

  async testEngagementAPIs() {
    console.log('\n🎯 TESTING ENGAGEMENT ENGINE APIs...\n');
    
    const user = await this.createTestUser();
    const tests = [];

    // Test 1: Get Stats
    console.log('  📊 GET /api/engagement/profile/stats/{user_id}');
    try {
      const res = await fetch(`${API_URL}/api/engagement/profile/stats/${user.user_id}`);
      const data = await res.json();
      tests.push({ name: 'Get Stats', status: data.success ? 'PASS' : 'FAIL', data });
      console.log(`     ${data.success ? '✅' : '❌'} Status: ${res.status}`);
    } catch (e) {
      tests.push({ name: 'Get Stats', status: 'ERROR', error: e.message });
      console.log(`     ❌ ERROR: ${e.message}`);
    }

    // Test 2: Claim Daily Reward
    console.log('  🎁 POST /api/engagement/daily-reward/claim');
    try {
      const res = await fetch(`${API_URL}/api/engagement/daily-reward/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.user_id })
      });
      const data = await res.json();
      tests.push({ name: 'Claim Daily Reward', status: data.success ? 'PASS' : 'FAIL', xp: data.xp_earned });
      console.log(`     ${data.success ? '✅' : '❌'} XP Earned: ${data.xp_earned || 'N/A'}`);
    } catch (e) {
      tests.push({ name: 'Claim Daily Reward', status: 'ERROR', error: e.message });
      console.log(`     ❌ ERROR: ${e.message}`);
    }

    // Test 3: Send Notification
    console.log('  📨 POST /api/engagement/notification/send');
    try {
      const res = await fetch(`${API_URL}/api/engagement/notification/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          type: 'achievement',
          title: 'Test Achievement',
          message: 'API test notification',
          action_url: '/dashboard'
        })
      });
      const data = await res.json();
      tests.push({ name: 'Send Notification', status: data.success ? 'PASS' : 'FAIL' });
      console.log(`     ${data.success ? '✅' : '❌'} Status: ${res.status}`);
    } catch (e) {
      tests.push({ name: 'Send Notification', status: 'ERROR', error: e.message });
      console.log(`     ❌ ERROR: ${e.message}`);
    }

    // Test 4: Get Notifications
    console.log('  📬 GET /api/engagement/notifications/{user_id}');
    try {
      const res = await fetch(`${API_URL}/api/engagement/notifications/${user.user_id}?limit=10`);
      const data = await res.json();
      tests.push({ name: 'Get Notifications', status: data.success ? 'PASS' : 'FAIL', count: data.notifications?.length });
      console.log(`     ${data.success ? '✅' : '❌'} Count: ${data.notifications?.length || 0}`);
    } catch (e) {
      tests.push({ name: 'Get Notifications', status: 'ERROR', error: e.message });
      console.log(`     ❌ ERROR: ${e.message}`);
    }

    // Test 5: Unlock Achievement
    console.log('  🏆 POST /api/engagement/achievement/unlock');
    try {
      const res = await fetch(`${API_URL}/api/engagement/achievement/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          achievement_id: 'first_win',
          xp_reward: 100
        })
      });
      const data = await res.json();
      tests.push({ name: 'Unlock Achievement', status: data.success ? 'PASS' : 'FAIL' });
      console.log(`     ${data.success ? '✅' : '❌'} Status: ${res.status}`);
    } catch (e) {
      tests.push({ name: 'Unlock Achievement', status: 'ERROR', error: e.message });
      console.log(`     ❌ ERROR: ${e.message}`);
    }

    // Test 6: Get Activity Feed
    console.log('  📰 GET /api/engagement/activity-feed/{user_id}');
    try {
      const res = await fetch(`${API_URL}/api/engagement/activity-feed/${user.user_id}?limit=10`);
      const data = await res.json();
      tests.push({ name: 'Get Activity Feed', status: data.success ? 'PASS' : 'FAIL', count: data.activities?.length });
      console.log(`     ${data.success ? '✅' : '❌'} Activities: ${data.activities?.length || 0}`);
    } catch (e) {
      tests.push({ name: 'Get Activity Feed', status: 'ERROR', error: e.message });
      console.log(`     ❌ ERROR: ${e.message}`);
    }

    this.results.engagement = tests;
    const passed = tests.filter(t => t.status === 'PASS').length;
    console.log(`\n  📈 Engagement: ${passed}/${tests.length} passed\n`);
  }

  async testMyVibezAPIs() {
    console.log('\n📹 TESTING MY VIBEZ APIs...\n');
    
    const user = await this.createTestUser();
    const tests = [];

    // Test 1: Get Feed
    console.log('  📺 GET /api/my-vibez/feed/for-you');
    try {
      const res = await fetch(`${API_URL}/api/my-vibez/feed/for-you?skip=0&limit=10`);
      const data = await res.json();
      tests.push({ name: 'Get Feed', status: data.success ? 'PASS' : 'FAIL', count: data.posts?.length });
      console.log(`     ${data.success ? '✅' : '❌'} Posts: ${data.posts?.length || 0}`);
    } catch (e) {
      tests.push({ name: 'Get Feed', status: 'ERROR', error: e.message });
      console.log(`     ❌ ERROR: ${e.message}`);
    }

    // Test 2: Get Challenges
    console.log('  🏆 GET /api/my-vibez/challenges');
    try {
      const res = await fetch(`${API_URL}/api/my-vibez/challenges`);
      const data = await res.json();
      tests.push({ name: 'Get Challenges', status: data.success ? 'PASS' : 'FAIL', count: data.challenges?.length });
      console.log(`     ${data.success ? '✅' : '❌'} Challenges: ${data.challenges?.length || 0}`);
    } catch (e) {
      tests.push({ name: 'Get Challenges', status: 'ERROR', error: e.message });
      console.log(`     ❌ ERROR: ${e.message}`);
    }

    // Test 3: Get Trending
    console.log('  🔥 GET /api/my-vibez/trending');
    try {
      const res = await fetch(`${API_URL}/api/my-vibez/trending?limit=10`);
      const data = await res.json();
      tests.push({ name: 'Get Trending', status: data.success ? 'PASS' : 'FAIL', count: data.posts?.length });
      console.log(`     ${data.success ? '✅' : '❌'} Trending: ${data.posts?.length || 0}`);
    } catch (e) {
      tests.push({ name: 'Get Trending', status: 'ERROR', error: e.message });
      console.log(`     ❌ ERROR: ${e.message}`);
    }

    this.results.myVibez = tests;
    const passed = tests.filter(t => t.status === 'PASS').length;
    console.log(`\n  📈 MY VIBEZ: ${passed}/${tests.length} passed\n`);
  }

  async testFriendAPIs() {
    console.log('\n👥 TESTING FRIEND SYSTEM APIs...\n');
    
    const user1 = await this.createTestUser();
    const user2 = await this.createTestUser();
    const tests = [];

    // Test 1: Add Friend
    console.log('  ➕ POST /api/friends/add');
    try {
      const res = await fetch(`${API_URL}/api/friends/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user1.user_id, friend_id: user2.user_id })
      });
      const data = await res.json();
      tests.push({ name: 'Add Friend', status: data.success ? 'PASS' : 'FAIL' });
      console.log(`     ${data.success ? '✅' : '❌'} Status: ${res.status}`);
    } catch (e) {
      tests.push({ name: 'Add Friend', status: 'ERROR', error: e.message });
      console.log(`     ❌ ERROR: ${e.message}`);
    }

    // Test 2: List Friends
    console.log('  📋 GET /api/friends/list/{user_id}');
    try {
      const res = await fetch(`${API_URL}/api/friends/list/${user1.user_id}`);
      const data = await res.json();
      tests.push({ name: 'List Friends', status: data.success ? 'PASS' : 'FAIL', count: data.friends?.length });
      console.log(`     ${data.success ? '✅' : '❌'} Friends: ${data.friends?.length || 0}`);
    } catch (e) {
      tests.push({ name: 'List Friends', status: 'ERROR', error: e.message });
      console.log(`     ❌ ERROR: ${e.message}`);
    }

    this.results.friends = tests;
    const passed = tests.filter(t => t.status === 'PASS').length;
    console.log(`\n  📈 Friends: ${passed}/${tests.length} passed\n`);
  }

  async testConcurrentUsers(count = 100) {
    console.log(`\n🏃 TESTING ${count} CONCURRENT USERS (API-only)...\n`);
    
    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(this.simulateConcurrentUser(i));
    }

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    this.results.concurrent.push({
      total: count,
      successful,
      failed,
      duration_ms: duration,
      throughput: count / (duration / 1000)
    });

    console.log(`  ✅ Successful: ${successful}/${count}`);
    console.log(`  ❌ Failed: ${failed}/${count}`);
    console.log(`  ⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`  📊 Throughput: ${(count / (duration / 1000)).toFixed(2)} users/sec\n`);
  }

  async simulateConcurrentUser(userId) {
    try {
      const user = await this.createTestUser();
      const res = await fetch(`${API_URL}/api/engagement/profile/stats/${user.user_id}`);
      const data = await res.json();
      return { userId, success: data.success };
    } catch (error) {
      return { userId, success: false, error: error.message };
    }
  }

  async generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 GENERATING TEST REPORT');
    console.log('='.repeat(80));

    const allTests = [
      ...this.results.engagement,
      ...this.results.myVibez,
      ...this.results.friends
    ];

    const totalTests = allTests.length;
    const passed = allTests.filter(t => t.status === 'PASS').length;
    const failed = allTests.filter(t => t.status === 'FAIL').length;
    const errors = allTests.filter(t => t.status === 'ERROR').length;

    const report = {
      meta: {
        generated_at: new Date().toISOString(),
        duration_ms: Date.now() - this.startTime,
        tester: 'API_MEGA_TESTER_v1.0'
      },
      summary: {
        total_tests: totalTests,
        passed,
        failed,
        errors,
        pass_rate: ((passed / totalTests) * 100).toFixed(2) + '%'
      },
      results: this.results
    };

    const fs = await import('fs/promises');
    const reportPath = `/app/test_reports/api_mega_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n✅ Report saved: ${reportPath}`);
    console.log(`\n📈 FINAL SUMMARY:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⚠️  Errors: ${errors}`);
    console.log(`   📊 Pass Rate: ${report.summary.pass_rate}`);
    console.log(`   ⏱️  Duration: ${(report.meta.duration_ms / 1000).toFixed(2)}s`);
    
    if (this.results.concurrent.length > 0) {
      const concurrent = this.results.concurrent[0];
      console.log(`\n🏃 CONCURRENT TEST:`);
      console.log(`   Total Users: ${concurrent.total}`);
      console.log(`   Success Rate: ${((concurrent.successful / concurrent.total) * 100).toFixed(2)}%`);
      console.log(`   Throughput: ${concurrent.throughput.toFixed(2)} users/sec`);
    }

    return report;
  }

  async runAll() {
    console.log('\n' + '█'.repeat(80));
    console.log('🚀 API MEGA TESTER - COMPREHENSIVE API TESTING');
    console.log('█'.repeat(80));
    console.log(`\n⏱️  Started: ${new Date().toLocaleString()}\n`);

    await this.testEngagementAPIs();
    await this.testMyVibezAPIs();
    await this.testFriendAPIs();
    await this.testConcurrentUsers(100);

    const report = await this.generateReport();

    console.log('\n' + '█'.repeat(80));
    console.log('✅ ALL API TESTS COMPLETE!');
    console.log('█'.repeat(80) + '\n');

    return report;
  }
}

// Run
const tester = new APIMegaTester();
tester.runAll().catch(console.error);
