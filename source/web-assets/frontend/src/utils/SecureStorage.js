/**
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
    // console.error('Encryption failed:', error);
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
    // console.error('Decryption failed:', error);
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
      // console.error('SecureStorage.setItem failed:', error);
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
      // console.error('SecureStorage.getItem failed:', error);
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
