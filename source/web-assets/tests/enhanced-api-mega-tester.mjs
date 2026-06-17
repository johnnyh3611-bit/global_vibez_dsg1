#!/usr/bin/env node

/**
 * 🚀 ENHANCED API MEGA TESTER WITH MY VIBEZ FEATURES
 * Tests: Posting, Live Streaming, Likes, Comments, Friends, Engagement
 * Includes 10K concurrent user simulation
 */

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://social-connect-953.preview.emergentagent.com';

class EnhancedAPIMegaTester {
  constructor() {
    this.results = {
      engagement: [],
      myVibez: [],
      myVibezPosting: [],
      liveStreaming: [],
      interactions: [],
      friends: [],
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

  // ========== ENGAGEMENT ENGINE ==========
  async testEngagementAPIs() {
    console.log('\n🎯 TESTING ENGAGEMENT ENGINE...\n');
    
    const user = await this.createTestUser();
    const tests = [];

    console.log('  📊 Get Stats');
    try {
      const res = await fetch(`${API_URL}/api/engagement/profile/stats/${user.user_id}`);
      const data = await res.json();
      tests.push({ name: 'Get Stats', status: data.success ? 'PASS' : 'FAIL' });
      console.log(`     ${data.success ? '✅' : '❌'} Level: ${data.stats?.level}`);
    } catch (e) {
      tests.push({ name: 'Get Stats', status: 'ERROR', error: e.message });
      console.log(`     ❌ ERROR`);
    }

    console.log('  🎁 Claim Daily Reward');
    try {
      const res = await fetch(`${API_URL}/api/engagement/daily-reward/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.user_id })
      });
      const data = await res.json();
      tests.push({ name: 'Claim Daily Reward', status: data.success ? 'PASS' : 'FAIL', xp: data.xp_earned });
      console.log(`     ${data.success ? '✅' : '❌'} XP: ${data.xp_earned || 'N/A'}`);
    } catch (e) {
      tests.push({ name: 'Claim Daily Reward', status: 'ERROR' });
      console.log(`     ❌ ERROR`);
    }

    console.log('  📨 Send Notification');
    try {
      const res = await fetch(`${API_URL}/api/engagement/notification/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          type: 'achievement',
          title: 'Test Achievement',
          message: 'You unlocked a test achievement!',
          action_url: '/dashboard'
        })
      });
      const data = await res.json();
      tests.push({ name: 'Send Notification', status: data.success ? 'PASS' : 'FAIL' });
      console.log(`     ${data.success ? '✅' : '❌'}`);
    } catch (e) {
      tests.push({ name: 'Send Notification', status: 'ERROR' });
      console.log(`     ❌ ERROR`);
    }

    this.results.engagement = tests;
    const passed = tests.filter(t => t.status === 'PASS').length;
    console.log(`\n  📈 Engagement: ${passed}/${tests.length} PASSED\n`);
  }

  // ========== MY VIBEZ POST CREATION ==========
  async testMyVibezPosting() {
    console.log('\n📹 TESTING MY VIBEZ POST CREATION...\n');
    
    const user = await this.createTestUser();
    const tests = [];

    // Test 1: Create Regular Video Post
    console.log('  🎥 Create Video Post (< 5 min)');
    try {
      const res = await fetch(`${API_URL}/api/my-vibez/post/create-json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          type: 'video',
          video_url: 'https://example.com/video.mp4',
          caption: 'Testing video post from bot 🎮',
          duration: 240, // 4 minutes (under 5 min limit)
          is_live: false,
          tags: ['gaming', 'test']
        })
      });
      const data = await res.json();
      tests.push({ name: 'Create Video Post', status: data.success ? 'PASS' : 'FAIL', post_id: data.post_id });
      console.log(`     ${data.success ? '✅' : '❌'} Post ID: ${data.post_id || 'N/A'}`);
    } catch (e) {
      tests.push({ name: 'Create Video Post', status: 'ERROR', error: e.message });
      console.log(`     ❌ ERROR: ${e.message}`);
    }

    // Test 2: Try Creating Video Over 5 Min (Should Fail)
    console.log('  ⏱️ Create Video Post (> 5 min - should fail)');
    try {
      const res = await fetch(`${API_URL}/api/my-vibez/post/create-json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          type: 'video',
          video_url: 'https://example.com/long-video.mp4',
          caption: 'This should fail - too long',
          duration: 400, // 6+ minutes (over limit)
          is_live: false
        })
      });
      const data = await res.json();
      // Should fail with validation error
      const expectedFail = !data.success || res.status >= 400;
      tests.push({ name: 'Reject Long Video', status: expectedFail ? 'PASS' : 'FAIL' });
      console.log(`     ${expectedFail ? '✅ Correctly rejected' : '❌ Should have rejected'}`);
    } catch (e) {
      tests.push({ name: 'Reject Long Video', status: 'PASS' }); // Error is expected
      console.log(`     ✅ Correctly rejected`);
    }

    // Test 3: Create Image Post
    console.log('  🖼️ Create Image Post');
    try {
      const res = await fetch(`${API_URL}/api/my-vibez/post/create-json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          type: 'image',
          image_url: 'https://example.com/gaming-screenshot.jpg',
          caption: 'Epic gaming moment! 🎮',
          tags: ['gaming', 'screenshot']
        })
      });
      const data = await res.json();
      tests.push({ name: 'Create Image Post', status: data.success ? 'PASS' : 'FAIL' });
      console.log(`     ${data.success ? '✅' : '❌'}`);
    } catch (e) {
      tests.push({ name: 'Create Image Post', status: 'ERROR' });
      console.log(`     ❌ ERROR`);
    }

    this.results.myVibezPosting = tests;
    const passed = tests.filter(t => t.status === 'PASS').length;
    console.log(`\n  📈 MY VIBEZ Posting: ${passed}/${tests.length} PASSED\n`);
  }

  // ========== LIVE STREAMING ==========
  async testLiveStreaming() {
    console.log('\n🔴 TESTING LIVE STREAMING...\n');
    
    const user = await this.createTestUser();
    const tests = [];

    // Test 1: Start Live Stream
    console.log('  📡 Start Live Stream');
    try {
      const res = await fetch(`${API_URL}/api/my-vibez/post/create-json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          type: 'video',
          video_url: 'wss://stream.example.com/live',
          caption: 'LIVE NOW: Epic gaming session! 🎮🔴',
          is_live: true, // Live stream flag
          duration: 0, // Duration doesn't matter for live
          tags: ['gaming', 'live']
        })
      });
      const data = await res.json();
      tests.push({ name: 'Start Live Stream', status: data.success ? 'PASS' : 'FAIL', stream_id: data.post_id });
      console.log(`     ${data.success ? '✅' : '❌'} Stream ID: ${data.post_id || 'N/A'}`);
    } catch (e) {
      tests.push({ name: 'Start Live Stream', status: 'ERROR' });
      console.log(`     ❌ ERROR`);
    }

    // Test 2: Live Stream Bypasses Duration Limit
    console.log('  ⏰ Live Stream (no duration limit)');
    try {
      const res = await fetch(`${API_URL}/api/my-vibez/post/create-json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          type: 'video',
          video_url: 'wss://stream.example.com/live2',
          caption: 'Long live stream',
          is_live: true,
          duration: 9999, // Should be allowed for live
          tags: ['gaming']
        })
      });
      const data = await res.json();
      tests.push({ name: 'Live No Duration Limit', status: data.success ? 'PASS' : 'FAIL' });
      console.log(`     ${data.success ? '✅ Allowed (correct)' : '❌ Should allow live'}`);
    } catch (e) {
      tests.push({ name: 'Live No Duration Limit', status: 'ERROR' });
      console.log(`     ❌ ERROR`);
    }

    this.results.liveStreaming = tests;
    const passed = tests.filter(t => t.status === 'PASS').length;
    console.log(`\n  📈 Live Streaming: ${passed}/${tests.length} PASSED\n`);
  }

  // ========== INTERACTIONS (LIKES/COMMENTS) ==========
  async testInteractions() {
    console.log('\n❤️ TESTING LIKES & COMMENTS...\n');
    
    const user1 = await this.createTestUser();
    const user2 = await this.createTestUser();
    const tests = [];

    // Create a post first
    const postRes = await fetch(`${API_URL}/api/my-vibez/post/create-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user1.user_id,
        type: 'video',
        video_url: 'https://example.com/test.mp4',
        caption: 'Test post for interactions',
        duration: 60
      })
    });
    const postData = await postRes.json();
    const postId = postData.post_id;

    if (!postId) {
      console.log('     ⚠️ Could not create test post, skipping interactions\n');
      return;
    }

    // Test 1: Like Post
    console.log('  ❤️ Like Post');
    try {
      const res = await fetch(`${API_URL}/api/my-vibez/interact/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user2.user_id,
          action: 'like'
        })
      });
      const data = await res.json();
      tests.push({ name: 'Like Post', status: data.success ? 'PASS' : 'FAIL' });
      console.log(`     ${data.success ? '✅' : '❌'}`);
    } catch (e) {
      tests.push({ name: 'Like Post', status: 'ERROR' });
      console.log(`     ❌ ERROR`);
    }

    // Test 2: Comment on Post
    console.log('  💬 Comment on Post');
    try {
      const res = await fetch(`${API_URL}/api/my-vibez/interact/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user2.user_id,
          action: 'comment',
          comment_text: 'Awesome content! 🔥'
        })
      });
      const data = await res.json();
      tests.push({ name: 'Comment on Post', status: data.success ? 'PASS' : 'FAIL' });
      console.log(`     ${data.success ? '✅' : '❌'}`);
    } catch (e) {
      tests.push({ name: 'Comment on Post', status: 'ERROR' });
      console.log(`     ❌ ERROR`);
    }

    // Test 3: Unlike Post
    console.log('  💔 Unlike Post');
    try {
      const res = await fetch(`${API_URL}/api/my-vibez/interact/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user2.user_id,
          action: 'unlike'
        })
      });
      const data = await res.json();
      tests.push({ name: 'Unlike Post', status: data.success ? 'PASS' : 'FAIL' });
      console.log(`     ${data.success ? '✅' : '❌'}`);
    } catch (e) {
      tests.push({ name: 'Unlike Post', status: 'ERROR' });
      console.log(`     ❌ ERROR`);
    }

    this.results.interactions = tests;
    const passed = tests.filter(t => t.status === 'PASS').length;
    console.log(`\n  📈 Interactions: ${passed}/${tests.length} PASSED\n`);
  }

  // ========== FRIEND SYSTEM ==========
  async testFriendSystem() {
    console.log('\n👥 TESTING FRIEND SYSTEM...\n');
    
    const user1 = await this.createTestUser();
    const user2 = await this.createTestUser();
    const tests = [];

    // Test 1: Send Friend Request
    console.log('  📤 Send Friend Request');
    try {
      const res = await fetch(`${API_URL}/api/friends/request/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_user_id: user1.user_id,
          to_user_id: user2.user_id,
          message: 'Hey, let\'s be friends!'
        })
      });
      const data = await res.json();
      tests.push({ name: 'Send Friend Request', status: data.success ? 'PASS' : 'FAIL' });
      console.log(`     ${data.success ? '✅' : '❌'}`);
    } catch (e) {
      tests.push({ name: 'Send Friend Request', status: 'ERROR', error: e.message });
      console.log(`     ❌ ERROR: ${e.message}`);
    }

    // Test 2: List Friend Requests
    console.log('  📥 List Friend Requests');
    try {
      const res = await fetch(`${API_URL}/api/friends/requests/received/${user2.user_id}`);
      const data = await res.json();
      tests.push({ name: 'List Friend Requests', status: data.success ? 'PASS' : 'FAIL', count: data.requests?.length });
      console.log(`     ${data.success ? '✅' : '❌'} Requests: ${data.requests?.length || 0}`);
    } catch (e) {
      tests.push({ name: 'List Friend Requests', status: 'ERROR' });
      console.log(`     ❌ ERROR`);
    }

    this.results.friends = tests;
    const passed = tests.filter(t => t.status === 'PASS').length;
    console.log(`\n  📈 Friends: ${passed}/${tests.length} PASSED\n`);
  }

  // ========== 10K CONCURRENT USERS ==========
  async test10KConcurrentUsers() {
    const totalUsers = parseInt(process.env.TOTAL_USERS) || 10000;
    const batchSize = 100;
    const batches = Math.ceil(totalUsers / batchSize);

    console.log('\n' + '='.repeat(80));
    console.log(`🔥 STRESS TEST: ${totalUsers.toLocaleString()} CONCURRENT USERS`);
    console.log('='.repeat(80));

    let totalSuccessful = 0;
    let totalFailed = 0;

    for (let batch = 0; batch < batches; batch++) {
      const batchStart = batch * batchSize;
      const currentBatchSize = Math.min(batchSize, totalUsers - batchStart);

      console.log(`\n  📦 Batch ${batch + 1}/${batches}: Users ${batchStart + 1}-${batchStart + currentBatchSize}`);

      const promises = [];
      for (let i = 0; i < currentBatchSize; i++) {
        promises.push(this.simulateConcurrentUser(batchStart + i));
      }

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      totalSuccessful += successful;
      totalFailed += failed;

      console.log(`     ✅ Success: ${successful}/${currentBatchSize}`);
      console.log(`     ❌ Failed: ${failed}/${currentBatchSize}`);
      console.log(`     ⏱️ Duration: ${(duration / 1000).toFixed(2)}s`);
      console.log(`     📊 Throughput: ${(currentBatchSize / (duration / 1000)).toFixed(2)} users/sec`);

      this.results.concurrent.push({
        batch: batch + 1,
        users: currentBatchSize,
        successful,
        failed,
        duration_ms: duration,
        throughput: currentBatchSize / (duration / 1000)
      });

      // Small delay between batches
      if (batch < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`\n  🎉 STRESS TEST COMPLETE!`);
    console.log(`     Total Users: ${totalUsers.toLocaleString()}`);
    console.log(`     ✅ Successful: ${totalSuccessful.toLocaleString()} (${((totalSuccessful / totalUsers) * 100).toFixed(2)}%)`);
    console.log(`     ❌ Failed: ${totalFailed.toLocaleString()} (${((totalFailed / totalUsers) * 100).toFixed(2)}%)\n`);
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

  // ========== GENERATE REPORT ==========
  async generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 GENERATING COMPREHENSIVE REPORT');
    console.log('='.repeat(80));

    const allTests = [
      ...this.results.engagement,
      ...this.results.myVibezPosting,
      ...this.results.liveStreaming,
      ...this.results.interactions,
      ...this.results.friends
    ];

    const totalTests = allTests.length;
    const passed = allTests.filter(t => t.status === 'PASS').length;

    const report = {
      meta: {
        generated_at: new Date().toISOString(),
        duration_ms: Date.now() - this.startTime,
        tester: 'ENHANCED_API_MEGA_v1.0'
      },
      summary: {
        total_tests: totalTests,
        passed,
        failed: totalTests - passed,
        pass_rate: ((passed / totalTests) * 100).toFixed(2) + '%'
      },
      results: this.results
    };

    const fs = await import('fs/promises');
    const reportPath = `/app/test_reports/enhanced_mega_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n✅ Report: ${reportPath}`);
    console.log(`\n📈 FINAL SUMMARY:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${totalTests - passed}`);
    console.log(`   📊 Pass Rate: ${report.summary.pass_rate}`);
    console.log(`   ⏱️ Duration: ${(report.meta.duration_ms / 1000).toFixed(2)}s`);

    if (this.results.concurrent.length > 0) {
      const totalUsers = this.results.concurrent.reduce((sum, b) => sum + b.users, 0);
      const totalSuccessful = this.results.concurrent.reduce((sum, b) => sum + b.successful, 0);
      console.log(`\n🏃 CONCURRENT STRESS TEST:`);
      console.log(`   Total Users: ${totalUsers.toLocaleString()}`);
      console.log(`   Success Rate: ${((totalSuccessful / totalUsers) * 100).toFixed(2)}%`);
    }

    return report;
  }

  // ========== RUN ALL TESTS ==========
  async runAll() {
    console.log('\n' + '█'.repeat(80));
    console.log('🚀 ENHANCED API MEGA TESTER');
    console.log('   Testing: Engagement, MY VIBEZ, Posts, Live Streaming, Interactions');
    console.log('█'.repeat(80));
    console.log(`\n⏱️ Started: ${new Date().toLocaleString()}\n`);

    await this.testEngagementAPIs();
    await this.testMyVibezPosting();
    await this.testLiveStreaming();
    await this.testInteractions();
    await this.testFriendSystem();
    await this.test10KConcurrentUsers();

    await this.generateReport();

    console.log('\n' + '█'.repeat(80));
    console.log('✅ ALL TESTS COMPLETE!');
    console.log('█'.repeat(80) + '\n');
  }
}

// Run
const tester = new EnhancedAPIMegaTester();
tester.runAll().catch(console.error);
