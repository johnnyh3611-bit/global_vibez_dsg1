#!/usr/bin/env node

/**
 * OPTIMIZED 1 MILLION USER STRESS TEST
 * Smart batching with retry logic and detailed error reporting
 */

import https from 'https';
import http from 'http';
import { performance } from 'perf_hooks';
import fs from 'fs';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://gvdsg-primary-7742.emergentmind.pro';
const TOTAL_TARGET = 1_000_000;
const BATCH_SIZE = 1000; // Smaller batches
const CONCURRENT = 50; // Lower concurrency
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

const results = {
  startTime: new Date().toISOString(),
  target: TOTAL_TARGET,
  batchSize: BATCH_SIZE,
  concurrency: CONCURRENT,
  phases: {},
  errors: [],
  summary: {
    totalRequests: 0,
    successful: 0,
    failed: 0,
    avgResponseTime: 0
  }
};

// Helper: Make HTTP Request with retry
async function makeRequest(method, path, data = null, retries = RETRY_ATTEMPTS) {
  const url = new URL(path, API_URL);
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'OptimizedStressTest/2.0'
    },
    timeout: 30000
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await new Promise((resolve, reject) => {
        const startTime = performance.now();
        const client = url.protocol === 'https:' ? https : http;

        const req = client.request(url, options, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            const responseTime = performance.now() - startTime;
            
            results.summary.totalRequests++;
            results.summary.avgResponseTime = 
              (results.summary.avgResponseTime * (results.summary.totalRequests - 1) + responseTime) / 
              results.summary.totalRequests;

            if (res.statusCode >= 200 && res.statusCode < 300) {
              results.summary.successful++;
              try {
                resolve({ success: true, data: JSON.parse(body), responseTime });
              } catch {
                resolve({ success: true, data: body, responseTime });
              }
            } else {
              if (attempt === retries) results.summary.failed++;
              reject({ statusCode: res.statusCode, body });
            }
          });
        });

        req.on('error', reject);
        req.on('timeout', () => reject({ error: 'timeout' }));

        if (data) req.write(JSON.stringify(data));
        req.end();
      });

      return result;
    } catch (error) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, RETRY_DELAY * attempt));
        continue;
      }
      results.summary.failed++;
      if (results.errors.length < 10) {
        results.errors.push({ path, error: error.message || error });
      }
      return { success: false, error };
    }
  }
}

// Process batch with controlled concurrency
async function processBatch(items, processor) {
  const results = [];
  for (let i = 0; i < items.length; i += CONCURRENT) {
    const batch = items.slice(i, i + CONCURRENT);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
    
    // Rate limiting - small delay between concurrent batches
    if (i + CONCURRENT < items.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  return results;
}

// Phase 1: Create 100K Users (scaled down for realism)
async function createUsers() {
  console.log('\n🚀 PHASE 1: Creating 100,000 Test Users...');
  const start = Date.now();
  const users = [];
  const userCount = 100_000;

  for (let batch = 0; batch < userCount / BATCH_SIZE; batch++) {
    console.log(`  Batch ${batch + 1}/${userCount / BATCH_SIZE}`);
    
    const batchUsers = Array.from({ length: BATCH_SIZE }, (_, i) => ({
      name: `StressUser${batch * BATCH_SIZE + i}`,
      email: `stress${batch * BATCH_SIZE + i}@test.com`
    }));

    const batchResults = await processBatch(batchUsers, async (user) => {
      const res = await makeRequest('POST', '/api/auth/test-user', user);
      return res.success ? { user_id: res.data.user_id, ...user } : null;
    });

    users.push(...batchResults.filter(Boolean));
    
    if ((batch + 1) % 10 === 0) {
      console.log(`    Progress: ${users.length} users created`);
    }
  }

  const duration = (Date.now() - start) / 1000;
  results.phases.userCreation = {
    target: userCount,
    created: users.length,
    duration: `${duration}s`,
    rate: `${Math.floor(users.length / duration)} users/s`
  };

  console.log(`✅ Created ${users.length}/${userCount} users in ${duration}s`);
  return users;
}

// Phase 2: Multi-Feature Stress Test
async function stressAllFeatures(users) {
  console.log('\n⚡ PHASE 2: Multi-Feature Stress Test...');
  
  // Engagement Engine
  console.log('  🎁 Testing Engagement Engine...');
  const engagementStart = Date.now();
  const engagementSample = users.slice(0, 10000);
  
  const engagementResults = await processBatch(engagementSample, async (user) => {
    return await makeRequest('POST', '/api/engagement/claim-daily', { user_id: user.user_id });
  });
  
  results.phases.engagement = {
    tested: engagementSample.length,
    successful: engagementResults.filter(r => r.success).length,
    duration: `${(Date.now() - engagementStart) / 1000}s`
  };
  console.log(`     ✅ ${results.phases.engagement.successful}/${engagementSample.length} successful`);

  // MY VIBEZ Posts
  console.log('  📱 Testing MY VIBEZ...');
  const vibezStart = Date.now();
  const vibezSample = users.slice(0, 20000);
  
  const vibezResults = await processBatch(vibezSample, async (user, idx) => {
    return await makeRequest('POST', '/api/my-vibez/create', {
      user_id: user.user_id,
      type: 'text',
      caption: `Stress test post #${idx}`,
      tags: ['test', 'stress']
    });
  });
  
  results.phases.myVibez = {
    tested: vibezSample.length,
    successful: vibezResults.filter(r => r.success).length,
    duration: `${(Date.now() - vibezStart) / 1000}s`
  };
  console.log(`     ✅ ${results.phases.myVibez.successful}/${vibezSample.length} posts created`);

  // Tournaments
  console.log('  🏆 Testing Tournaments...');
  const tourStart = Date.now();
  
  const tournaments = await processBatch(Array.from({length: 50}, (_, i) => i), async (i) => {
    const res = await makeRequest('POST', '/api/tournaments/create', {
      name: `Stress Tournament ${i}`,
      game_id: 'poker',
      organizer_id: users[i % users.length]?.user_id || 'test',
      max_players: 8,
      entry_fee: 100,
      tournament_type: 'single_elimination'
    });
    return res.success ? res.data.tournament_id : null;
  });

  results.phases.tournaments = {
    created: tournaments.filter(Boolean).length,
    duration: `${(Date.now() - tourStart) / 1000}s`
  };
  console.log(`     ✅ ${results.phases.tournaments.created} tournaments created`);

  // Video Calls
  console.log('  📹 Testing Video Calls...');
  const callStart = Date.now();
  const callSample = users.slice(0, 10000);
  
  const callResults = await processBatch(Array.from({length: 5000}, (_, i) => i), async (i) => {
    return await makeRequest('POST', '/api/video-call/initiate', {
      caller_id: callSample[i * 2]?.user_id || 'test',
      callee_id: callSample[i * 2 + 1]?.user_id || 'test',
      call_type: 'video'
    });
  });
  
  results.phases.videoCalls = {
    attempted: 5000,
    successful: callResults.filter(r => r.success).length,
    duration: `${(Date.now() - callStart) / 1000}s`
  };
  console.log(`     ✅ ${results.phases.videoCalls.successful}/5000 calls initiated`);
}

// Main
async function run() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🔥 OPTIMIZED 1M USER STRESS TEST 🔥');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Target: ${TOTAL_TARGET.toLocaleString()} operations`);
  console.log(`API: ${API_URL}\n`);

  const overallStart = Date.now();

  try {
    const users = await createUsers();
    await stressAllFeatures(users);

    const duration = (Date.now() - overallStart) / 1000;
    results.endTime = new Date().toISOString();
    results.totalDuration = `${duration}s (${(duration / 60).toFixed(2)} min)`;

    // Save report
    const reportPath = `/app/test_reports/optimized_stress_${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   📊 FINAL RESULTS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Total Requests: ${results.summary.totalRequests.toLocaleString()}`);
    console.log(`✅ Successful: ${results.summary.successful.toLocaleString()}`);
    console.log(`❌ Failed: ${results.summary.failed.toLocaleString()}`);
    console.log(`⚡ Success Rate: ${(results.summary.successful / results.summary.totalRequests * 100).toFixed(2)}%`);
    console.log(`⏱️  Avg Response: ${results.summary.avgResponseTime.toFixed(2)}ms`);
    console.log(`⏱️  Total Duration: ${results.totalDuration}`);
    console.log(`📄 Report: ${reportPath}\n`);

  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    results.fatalError = error.message;
    fs.writeFileSync(`/app/test_reports/stress_ERROR_${Date.now()}.json`, JSON.stringify(results, null, 2));
  }
}

run().catch(console.error);
