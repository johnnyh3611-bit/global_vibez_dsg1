#!/usr/bin/env node

/**
 * Firebase Service Worker Config Injector
 * 
 * Service workers cannot access process.env, so we need to inject
 * Firebase config values at build time.
 * 
 * This script replaces placeholders in firebase-messaging-sw.js with
 * actual environment variable values.
 */

const fs = require('fs');
const path = require('path');

// Load .env file if it exists
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  });
}

// Read environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Validate all required environment variables are present
const missingVars = Object.entries(firebaseConfig)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('❌ Missing required Firebase environment variables:');
  missingVars.forEach(key => console.error(`   - REACT_APP_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`));
  process.exit(1);
}

// Read service worker file
const swPath = path.join(__dirname, '../public/firebase-messaging-sw.js');
let swContent = fs.readFileSync(swPath, 'utf8');

// Replace placeholders with actual values
Object.entries(firebaseConfig).forEach(([key, value]) => {
  // Convert camelCase to SCREAMING_SNAKE_CASE for placeholder
  const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase();
  const placeholder = `__FIREBASE${snakeKey}__`;
  swContent = swContent.replace(new RegExp(placeholder, 'g'), value);
});

// Write the updated file to build directory
const buildSwPath = path.join(__dirname, '../build/firebase-messaging-sw.js');
fs.mkdirSync(path.dirname(buildSwPath), { recursive: true });
fs.writeFileSync(buildSwPath, swContent);

console.log('✅ Firebase Service Worker config injected successfully');
console.log(`   Source: ${swPath}`);
console.log(`   Output: ${buildSwPath}`);
console.log('   Config values injected:');
Object.keys(firebaseConfig).forEach(key => {
  console.log(`   - ${key}: ${firebaseConfig[key].substring(0, 10)}...`);
});
