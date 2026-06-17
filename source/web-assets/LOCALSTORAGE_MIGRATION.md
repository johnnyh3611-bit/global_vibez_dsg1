
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
