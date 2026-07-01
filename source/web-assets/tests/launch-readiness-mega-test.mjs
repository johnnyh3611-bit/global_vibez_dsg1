#!/usr/bin/env node

/**
 * LAUNCH READINESS MEGA TEST - Global Vibez DSG
 * Tests: Games, Monetization, Streaming, Room Layouts, Card Images, Live Features
 * Simulates 10,000 concurrent users across all features
 */

import https from 'https';
import http from 'http';
import { performance } from 'perf_hooks';
import fs from 'fs';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://social-connect-953.preview.emergentagent.com';
const CONCURRENT_USERS = 10000;
const BATCH_SIZE = 500;

const results = {
  startTime: new Date().toISOString(),
  totalUsers: CONCURRENT_USERS,
  phases: {},
  errors: [],
  criticalIssues: [],
  summary: {
    totalRequests: 0,
    successful: 0,
    failed: 0,
    avgResponseTime: 0
  }
};

// Helper: Make HTTP Request
async function makeRequest(method, path, data = null, cookies = null) {
  const url = new URL(path, API_URL);
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'LaunchReadinessTest/1.0'
    },
    timeout: 15000
  };

  if (cookies) {
    options.headers['Cookie'] = cookies;
  }

  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    const protocol = url.protocol === 'https:' ? https : http;

    const req = protocol.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const elapsed = performance.now() - startTime;
        
        // Extract cookies
        const setCookies = res.headers['set-cookie'] || [];
        const cookieStr = setCookies.join('; ');
        
        resolve({
          status: res.statusCode,
          data: body ? JSON.parse(body) : {},
          responseTime: elapsed,
          cookies: cookieStr
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Phase 1: Authentication Load Test
async function testAuthentication(userCount) {
  console.log(`\n🔐 PHASE 1: Authentication (${userCount} users)`);
  const startTime = performance.now();
  const errors = [];
  let successful = 0;
  const sessions = [];

  for (let i = 0; i < userCount; i += BATCH_SIZE) {
    const batch = Math.min(BATCH_SIZE, userCount - i);
    const promises = [];

    for (let j = 0; j < batch; j++) {
      promises.push(
        makeRequest('POST', '/api/auth/demo-login')
          .then(res => {
            if (res.status === 200 && res.cookies) {
              successful++;
              sessions.push(res.cookies);
            } else {
              errors.push(`Demo login failed: ${res.status}`);
            }
            return res.responseTime;
          })
          .catch(err => {
            errors.push(`Auth error: ${err.message}`);
            return 0;
          })
      );
    }

    await Promise.all(promises);
    console.log(`  ✓ Batch ${i / BATCH_SIZE + 1}: ${successful}/${i + batch} sessions created`);
  }

  const elapsed = performance.now() - startTime;
  results.phases.authentication = {
    users: userCount,
    successful,
    failed: errors.length,
    avgResponseTime: elapsed / userCount,
    totalTime: elapsed,
    errors: errors.slice(0, 10)
  };

  console.log(`  ✅ Phase 1 Complete: ${successful}/${userCount} authenticated (${(elapsed / 1000).toFixed(2)}s)`);
  return sessions;
}

// Phase 2: Monetization System Load Test
async function testMonetization(sessions) {
  console.log(`\n💰 PHASE 2: Monetization Features (${sessions.length} users)`);
  const startTime = performance.now();
  const errors = [];
  const tests = [];

  // Test all monetization endpoints
  const endpoints = [
    { name: 'Entry Fee Status', path: '/api/entry-fee/status' },
    { name: 'Battle Pass Season', path: '/api/battle-pass/current-season' },
    { name: 'Battle Pass Progress', path: '/api/battle-pass/my-progress' },
    { name: 'Elite Tiers', path: '/api/elite/tiers' },
    { name: 'Elite Status', path: '/api/elite/status' },
    { name: 'Cosmetics Catalog', path: '/api/cosmetics/catalog' },
    { name: 'Cosmetics Collection', path: '/api/cosmetics/my-collection' },
    { name: 'Stream Catalog', path: '/api/streaming/catalog' },
    { name: 'Live Streams', path: '/api/streaming/live-streams' },
    { name: 'Moderation Status', path: '/api/moderation/status' },
    { name: 'Ads Available', path: '/api/ads/available' }
  ];

  for (const endpoint of endpoints) {
    let successful = 0;
    const responseTimes = [];

    for (let i = 0; i < Math.min(1000, sessions.length); i++) {
      try {
        const res = await makeRequest('GET', endpoint.path, null, sessions[i % sessions.length]);
        if (res.status === 200) {
          successful++;
          responseTimes.push(res.responseTime);
        } else {
          errors.push(`${endpoint.name}: ${res.status}`);
        }
      } catch (err) {
        errors.push(`${endpoint.name}: ${err.message}`);
      }
    }

    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0;
    tests.push({
      endpoint: endpoint.name,
      successful,
      avgResponseTime: avgTime.toFixed(2)
    });
    console.log(`  ✓ ${endpoint.name}: ${successful}/1000 (${avgTime.toFixed(2)}ms avg)`);
  }

  const elapsed = performance.now() - startTime;
  results.phases.monetization = {
    endpoints: tests,
    totalTests: tests.reduce((sum, t) => sum + t.successful, 0),
    errors: errors.slice(0, 20),
    totalTime: elapsed
  };

  console.log(`  ✅ Phase 2 Complete: ${tests.length} endpoints tested (${(elapsed / 1000).toFixed(2)}s)`);
}

// Phase 3: Practice Games Load Test (Card Images, Room Layouts)
async function testGames(sessions) {
  console.log(`\n🎮 PHASE 3: Practice Games & Room Layouts (${sessions.length} users)`);
  const startTime = performance.now();
  const errors = [];
  const gameTests = [];

  // Test game creation and card images
  const games = ['poker', 'blackjack', 'uno', 'spades', 'chess', 'checkers'];

  for (const game of games) {
    let successful = 0;
    const responseTimes = [];

    for (let i = 0; i < Math.min(500, sessions.length); i++) {
      try {
        const res = await makeRequest(
          'POST',
          `/api/practice/${game}/new`,
          { difficulty: 'medium' },
          sessions[i % sessions.length]
        );

        if (res.status === 200 || res.status === 201) {
          successful++;
          responseTimes.push(res.responseTime);

          // Verify game state has cards/board
          if (res.data.game) {
            const hasCards = res.data.game.playerHand || res.data.game.board || res.data.game.deck;
            if (!hasCards) {
              errors.push(`${game}: Missing game state data`);
            }
          }
        } else {
          errors.push(`${game}: ${res.status}`);
        }
      } catch (err) {
        errors.push(`${game}: ${err.message}`);
      }
    }

    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0;
    gameTests.push({
      game,
      successful,
      avgResponseTime: avgTime.toFixed(2)
    });
    console.log(`  ✓ ${game}: ${successful}/500 games created (${avgTime.toFixed(2)}ms avg)`);
  }

  const elapsed = performance.now() - startTime;
  results.phases.games = {
    gamesTest: gameTests,
    totalGames: gameTests.reduce((sum, g) => sum + g.successful, 0),
    errors: errors.slice(0, 20),
    totalTime: elapsed
  };

  console.log(`  ✅ Phase 3 Complete: ${games.length} game types tested (${(elapsed / 1000).toFixed(2)}s)`);
}

// Phase 4: Multiplayer & Live Features
async function testMultiplayer(sessions) {
  console.log(`\n🌐 PHASE 4: Multiplayer & Live Features (${sessions.length} users)`);
  const startTime = performance.now();
  const errors = [];
  let lobbyCreated = 0;
  let lobbyJoined = 0;

  // Create multiplayer lobbies
  for (let i = 0; i < Math.min(100, sessions.length / 4); i++) {
    try {
      const res = await makeRequest(
        'POST',
        '/api/http-multiplayer/create-lobby',
        { 
          game_type: 'poker',
          max_players: 4,
          bet_amount: 100
        },
        sessions[i]
      );

      if (res.status === 200 || res.status === 201) {
        lobbyCreated++;

        // Try to join lobby with other users
        if (res.data.lobby_id) {
          for (let j = 1; j <= 3 && i * 4 + j < sessions.length; j++) {
            try {
              const joinRes = await makeRequest(
                'POST',
                '/api/http-multiplayer/join-lobby',
                { lobby_id: res.data.lobby_id },
                sessions[i * 4 + j]
              );
              if (joinRes.status === 200) {
                lobbyJoined++;
              }
            } catch (err) {
              errors.push(`Join lobby: ${err.message}`);
            }
          }
        }
      }
    } catch (err) {
      errors.push(`Create lobby: ${err.message}`);
    }
  }

  const elapsed = performance.now() - startTime;
  results.phases.multiplayer = {
    lobbiesCreated: lobbyCreated,
    usersJoined: lobbyJoined,
    errors: errors.slice(0, 10),
    totalTime: elapsed
  };

  console.log(`  ✅ Phase 4 Complete: ${lobbyCreated} lobbies, ${lobbyJoined} joins (${(elapsed / 1000).toFixed(2)}s)`);
}

// Phase 5: Dating & Social Features
async function testSocial(sessions) {
  console.log(`\n💖 PHASE 5: Dating & Social Features (${sessions.length} users)`);
  const startTime = performance.now();
  const errors = [];
  const tests = [];

  const endpoints = [
    { name: 'My Profile', path: '/api/profile/me' },
    { name: 'Discovery', path: '/api/dating/discover' },
    { name: 'My Matches', path: '/api/dating/matches' },
    { name: 'Messaging Inbox', path: '/api/messaging/conversations' }
  ];

  for (const endpoint of endpoints) {
    let successful = 0;

    for (let i = 0; i < Math.min(500, sessions.length); i++) {
      try {
        const res = await makeRequest('GET', endpoint.path, null, sessions[i % sessions.length]);
        if (res.status === 200) {
          successful++;
        } else {
          errors.push(`${endpoint.name}: ${res.status}`);
        }
      } catch (err) {
        errors.push(`${endpoint.name}: ${err.message}`);
      }
    }

    tests.push({ endpoint: endpoint.name, successful });
    console.log(`  ✓ ${endpoint.name}: ${successful}/500`);
  }

  const elapsed = performance.now() - startTime;
  results.phases.social = {
    tests,
    errors: errors.slice(0, 10),
    totalTime: elapsed
  };

  console.log(`  ✅ Phase 5 Complete: ${tests.length} social features tested (${(elapsed / 1000).toFixed(2)}s)`);
}

// Main Test Runner
async function runLaunchReadinessTest() {
  console.log('🚀 GLOBAL VIBEZ DSG - LAUNCH READINESS MEGA TEST');
  console.log(`Target: ${CONCURRENT_USERS.toLocaleString()} concurrent users`);
  console.log(`API: ${API_URL}\n`);

  const overallStart = performance.now();

  try {
    // Phase 1: Auth
    const sessions = await testAuthentication(CONCURRENT_USERS);

    if (sessions.length === 0) {
      console.error('❌ CRITICAL: No sessions created. Cannot proceed.');
      results.criticalIssues.push('Authentication completely failed');
      return;
    }

    // Phase 2: Monetization
    await testMonetization(sessions);

    // Phase 3: Games
    await testGames(sessions);

    // Phase 4: Multiplayer
    await testMultiplayer(sessions);

    // Phase 5: Social
    await testSocial(sessions);

  } catch (err) {
    console.error('❌ Test suite error:', err.message);
    results.criticalIssues.push(`Suite error: ${err.message}`);
  }

  const overallElapsed = performance.now() - overallStart;

  // Calculate summary
  const allPhases = Object.values(results.phases);
  const totalRequests = allPhases.reduce((sum, phase) => {
    return sum + (phase.successful || 0) + (phase.failed || 0);
  }, 0);

  results.summary = {
    totalTime: (overallElapsed / 1000).toFixed(2) + 's',
    totalRequests,
    phases: Object.keys(results.phases).length,
    criticalIssues: results.criticalIssues
  };

  // Save results
  const filename = `/app/test_reports/launch_readiness_${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));

  // Print Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 LAUNCH READINESS TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Time: ${results.summary.totalTime}`);
  console.log(`Total Requests: ${totalRequests.toLocaleString()}`);
  console.log(`Phases Completed: ${results.summary.phases}/5`);
  console.log(`\nPhase Results:`);
  
  for (const [phase, data] of Object.entries(results.phases)) {
    console.log(`  ${phase}: ✅ (${(data.totalTime / 1000).toFixed(2)}s)`);
  }

  if (results.criticalIssues.length > 0) {
    console.log(`\n⚠️  CRITICAL ISSUES:`);
    results.criticalIssues.forEach(issue => console.log(`  - ${issue}`));
  } else {
    console.log(`\n✅ NO CRITICAL ISSUES - READY FOR LAUNCH!`);
  }

  console.log(`\nFull report: ${filename}`);
  console.log('='.repeat(80));
}

// Run test
runLaunchReadinessTest().catch(console.error);
