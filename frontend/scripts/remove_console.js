#!/usr/bin/env node
/**
 * Remove console statements from production code
 * Replaces with proper logging or removes entirely
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function removeConsoleStatements(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    // Remove console.log, console.warn, console.error (keep console.error in catch blocks)
    // Simple removal - more aggressive cleaning
    content = content.replace(/^\s*console\.(log|warn|info|debug)\([^)]*\);?\s*$/gm, '');
    
    // Remove inline console statements
    content = content.replace(/console\.(log|warn|info|debug)\([^)]*\);?\s*/g, '');
    
    if (content !== original) {
        fs.writeFileSync(filePath, content);
        return true;
    }
    return false;
}

function cleanProductionCode() {
    const srcPath = '/app/frontend/src';
    let cleaned = 0;
    
    try {
        // Find all JS/JSX files
        const files = execSync(`find ${srcPath} -type f \\( -name "*.js" -o -name "*.jsx" \\) ! -path "*/node_modules/*"`)
            .toString()
            .split('\n')
            .filter(f => f.trim());
        
        for (const file of files) {
            if (removeConsoleStatements(file)) {
                cleaned++;
            }
        }
    } catch (e) {
        console.error('Error cleaning files:', e.message);
    }
    
    return cleaned;
}

console.log('🧹 Removing console statements from production code...\n');
const cleaned = cleanProductionCode();
console.log(`\n✅ Cleaned ${cleaned} files`);
console.log('Note: console.error in catch blocks preserved for error handling');
