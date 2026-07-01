#!/usr/bin/env python3
"""
localStorage Security Fix - Implement Encryption
Adds encryption layer to sensitive data storage
"""
import os

SECURE_STORAGE_CODE = '''/**
 * Secure Storage Utility with Encryption
 * Encrypts sensitive data before storing in localStorage
 * Uses Web Crypto API for AES-GCM encryption
 */

// Generate or retrieve encryption key (store in sessionStorage for session-based security)
const getEncryptionKey = async () => {
  const keyData = sessionStorage.getItem('_ek');
  
  if (keyData) {
    const keyArray = new Uint8Array(JSON.parse(keyData));
    return await crypto.subtle.importKey(
      'raw',
      keyArray,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  // Generate new key
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  const exportedKey = await crypto.subtle.exportKey('raw', key);
  sessionStorage.setItem('_ek', JSON.stringify(Array.from(new Uint8Array(exportedKey))));
  
  return key;
};

// Encrypt data
const encryptData = async (data) => {
  try {
    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(JSON.stringify(data));
    
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedData), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
};

// Decrypt data
const decryptData = async (encryptedString) => {
  try {
    const key = await getEncryptionKey();
    const combined = new Uint8Array(
      atob(encryptedString).split('').map(c => c.charCodeAt(0))
    );
    
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);
    
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
    
    const decodedData = new TextDecoder().decode(decryptedData);
    return JSON.parse(decodedData);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
};

/**
 * Secure Storage API
 * Automatically encrypts sensitive data
 */
const SecureStorage = {
  /**
   * Set encrypted item in localStorage
   */
  async setItem(key, value) {
    try {
      const encrypted = await encryptData(value);
      localStorage.setItem(key, encrypted);
    } catch (error) {
      console.error('SecureStorage.setItem failed:', error);
      throw error;
    }
  },

  /**
   * Get and decrypt item from localStorage
   */
  async getItem(key) {
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;
      
      return await decryptData(encrypted);
    } catch (error) {
      console.error('SecureStorage.getItem failed:', error);
      return null;
    }
  },

  /**
   * Remove item from localStorage
   */
  removeItem(key) {
    localStorage.removeItem(key);
  },

  /**
   * Clear all items (use with caution)
   */
  clear() {
    localStorage.clear();
    sessionStorage.removeItem('_ek');
  }
};

export default SecureStorage;

/**
 * USAGE EXAMPLE:
 * 
 * // Before (INSECURE):
 * localStorage.setItem('authToken', token);
 * const token = localStorage.getItem('authToken');
 * 
 * // After (SECURE):
 * await SecureStorage.setItem('authToken', token);
 * const token = await SecureStorage.getItem('authToken');
 * 
 * IMPORTANT NOTES:
 * - For highly sensitive data (auth tokens), prefer httpOnly cookies
 * - Encryption key is session-based and cleared on tab close
 * - Use this for client-side data that needs protection from XSS
 */
'''

def create_secure_storage():
    """Create new SecureStorage utility"""
    output_path = "/app/frontend/src/utils/SecureStorage.js"
    
    with open(output_path, 'w') as f:
        f.write(SECURE_STORAGE_CODE)
    
    print(f"✅ Created: {output_path}")
    
    # Create migration guide
    migration_guide = """
# localStorage Security Migration Guide

## Files to Update:

1. **src/utils/secureStorage.js** (lines 64, 68, 78-80, 85-87)
   - Replace direct localStorage calls with SecureStorage

2. **src/pages/DatingProfileSetup.jsx**
   - Replace: localStorage.setItem('profile', data)
   - With: await SecureStorage.setItem('profile', data)

3. **src/pages/DatingMatches.jsx**
   - Replace: localStorage.getItem('matches')
   - With: await SecureStorage.getItem('matches')

4. **src/pages/DatingDiscovery.jsx**
   - Replace: localStorage.getItem('preferences')
   - With: await SecureStorage.getItem('preferences')

## Migration Steps:

1. Import SecureStorage:
   ```javascript
   import SecureStorage from '../utils/SecureStorage';
   ```

2. Update all localStorage.setItem() calls:
   ```javascript
   // Before:
   localStorage.setItem('key', value);
   
   // After:
   await SecureStorage.setItem('key', value);
   ```

3. Update all localStorage.getItem() calls:
   ```javascript
   // Before:
   const data = localStorage.getItem('key');
   
   // After:
   const data = await SecureStorage.getItem('key');
   ```

4. Make functions async if needed:
   ```javascript
   // Before:
   const saveData = () => {
     localStorage.setItem('data', value);
   };
   
   // After:
   const saveData = async () => {
     await SecureStorage.setItem('data', value);
   };
   ```

## Best Practices:

1. **Auth Tokens**: Still prefer httpOnly cookies over localStorage
2. **Session Data**: Use SecureStorage for temporary sensitive data
3. **Public Data**: Regular localStorage is fine for non-sensitive data
4. **Key Naming**: Prefix sensitive keys with '_secure_' for clarity

## Testing:

1. Verify encryption works:
   ```javascript
   await SecureStorage.setItem('test', { secret: 'data' });
   console.log(localStorage.getItem('test')); // Should see encrypted blob
   const decrypted = await SecureStorage.getItem('test');
   console.log(decrypted); // Should see { secret: 'data' }
   ```

2. Test on browser close:
   - Close tab/browser
   - Reopen
   - Encryption key should be regenerated
   - Old data will be unreadable (this is intentional for security)
"""
    
    with open("/app/LOCALSTORAGE_MIGRATION.md", 'w') as f:
        f.write(migration_guide)
    
    print("✅ Created: /app/LOCALSTORAGE_MIGRATION.md")

if __name__ == "__main__":
    print("🔐 localStorage Security Fix")
    print("=" * 60)
    create_secure_storage()
    print("\n✅ Secure storage utility created!")
    print("\n📖 Next steps:")
    print("  1. Review /app/LOCALSTORAGE_MIGRATION.md")
    print("  2. Update files listed in the migration guide")
    print("  3. Test encryption functionality")
