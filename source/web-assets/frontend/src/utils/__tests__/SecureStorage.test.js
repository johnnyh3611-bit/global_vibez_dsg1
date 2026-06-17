/**
 * SecureStorage Test Suite
 * Verifies AES-GCM encryption functionality
 */

import SecureStorage from '../SecureStorage';

describe('SecureStorage', () => {
  beforeEach(() => {
    // Clear storage before each test
    localStorage.clear();
    sessionStorage.clear();
  });

  test('should encrypt and decrypt simple string', async () => {
    const testData = 'sensitive data';
    
    await SecureStorage.setItem('test', testData);
    const retrieved = await SecureStorage.getItem('test');
    
    expect(retrieved).toBe(testData);
  });

  test('should encrypt and decrypt object', async () => {
    const testData = {
      user_id: '12345',
      email: 'test@example.com',
      preferences: { theme: 'dark' }
    };
    
    await SecureStorage.setItem('user_data', testData);
    const retrieved = await SecureStorage.getItem('user_data');
    
    expect(retrieved).toEqual(testData);
  });

  test('should store encrypted blob in localStorage', async () => {
    const testData = 'secret';
    
    await SecureStorage.setItem('test', testData);
    const rawStored = localStorage.getItem('test');
    
    // Should NOT be plaintext
    expect(rawStored).not.toBe(testData);
    // Should be base64 encrypted blob
    expect(rawStored).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  test('should return null for non-existent key', async () => {
    const result = await SecureStorage.getItem('nonexistent');
    expect(result).toBeNull();
  });

  test('should remove item', async () => {
    await SecureStorage.setItem('test', 'data');
    SecureStorage.removeItem('test');
    
    const result = await SecureStorage.getItem('test');
    expect(result).toBeNull();
  });

  test('should clear all data', async () => {
    await SecureStorage.setItem('key1', 'value1');
    await SecureStorage.setItem('key2', 'value2');
    
    SecureStorage.clear();
    
    const result1 = await SecureStorage.getItem('key1');
    const result2 = await SecureStorage.getItem('key2');
    
    expect(result1).toBeNull();
    expect(result2).toBeNull();
  });

  test('should handle encryption errors gracefully', async () => {
    // Spy on crypto.subtle.encrypt to force failure, then restore.
    const spy = jest
      .spyOn(window.crypto.subtle, 'encrypt')
      .mockImplementation(() => Promise.reject(new Error('Crypto failed')));

    await expect(SecureStorage.setItem('test', 'data')).rejects.toThrow();

    spy.mockRestore();
  });

  test('should generate new key each session', async () => {
    await SecureStorage.setItem('test', 'data1');
    const encrypted1 = localStorage.getItem('test');
    
    // Simulate new session
    sessionStorage.removeItem('_ek');
    
    await SecureStorage.setItem('test', 'data1');
    const encrypted2 = localStorage.getItem('test');
    
    // Same plaintext, different encrypted output (different keys)
    expect(encrypted1).not.toBe(encrypted2);
  });

  test('should not decrypt data from previous session', async () => {
    await SecureStorage.setItem('test', 'data');
    const encryptedData = localStorage.getItem('test');
    
    // Simulate browser close/reopen - key is lost
    sessionStorage.removeItem('_ek');
    
    // Old encrypted data should not decrypt with new key
    const result = await SecureStorage.getItem('test');
    expect(result).toBeNull(); // Decryption fails, returns null
  });
});
