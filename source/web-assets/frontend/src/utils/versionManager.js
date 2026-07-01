/**
 * Version Management & Cache Busting
 * Automatically detects when app is updated and forces reload
 */

const APP_VERSION = process.env.REACT_APP_VERSION || '1.0.0';
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const checkForUpdates = async () => {
  try {
    // Don't reload mid-login — wipes the freshly-stored auth_token + redirects
    // user back to /login → infinite loop. The login handler sets this flag
    // before fetch() and clears it after navigate('/dashboard').
    if (localStorage.getItem('auth_in_progress') === '1') {
      return;
    }
    // Don't reload while user is on the /login page either — same reason.
    if (typeof window !== 'undefined' && window.location?.pathname === '/login') {
      return;
    }

    // Fetch version.json with cache-busting query param
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store'
    });
    
    if (!response.ok) return;
    
    const { version } = await response.json();

    // First-ever visit (no version stored yet) — bootstrap silently so we
    // don't reload-bomb users right after they just logged in. The reload
    // here was killing the demo-login flow: token landed in localStorage,
    // /dashboard mounted, then this reload aborted /api/auth/me → the
    // ProtectedRoute catch handler bounced the user back to /login.
    const stored = localStorage.getItem('app_version');
    if (!stored) {
      localStorage.setItem('app_version', version);
      return;
    }

    if (version !== stored) {
      console.log(`🔄 New version detected: ${version} (current: ${stored})`);

      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Update stored version
      localStorage.setItem('app_version', version);

      // Force reload to get new assets
      window.location.reload(true);
    }
  } catch (error) {
    console.error('Version check failed:', error);
  }
};

// Start periodic version checking
export const startVersionMonitoring = () => {
  // Check on load
  checkForUpdates();
  
  // Check every 5 minutes
  setInterval(checkForUpdates, VERSION_CHECK_INTERVAL);
  
  // Check when user comes back to tab
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkForUpdates();
    }
  });
};

export default {
  checkForUpdates,
  startVersionMonitoring
};
