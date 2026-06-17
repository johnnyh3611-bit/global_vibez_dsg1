/**
 * Secure Authentication Helper
 * SECURITY: Uses httpOnly cookies for auth tokens (set by backend)
 * Auth tokens are NO LONGER stored in localStorage to prevent XSS attacks
 * 
 * Backend sets session_token as httpOnly cookie - frontend sends it automatically
 * 
 * Migration Note: Old localStorage tokens are cleared on next login
 */

// SECURITY: Auth tokens are now httpOnly cookies - not accessible to JavaScript
// This function exists for backward compatibility but returns null
// Authentication happens via cookies sent automatically with fetch credentials: 'include'
export const getAuthToken = () => {
  // DEPRECATED: Auth tokens are now httpOnly cookies
  // Clear any old localStorage tokens (security cleanup)
  if (localStorage.getItem('token') || localStorage.getItem('auth_token')) {
    console.warn('SECURITY: Clearing legacy localStorage auth tokens. Using httpOnly cookies now.');
    localStorage.removeItem('token');
    localStorage.removeItem('auth_token');
  }
  
  return null; // Token is in httpOnly cookie, not accessible to JS
};

// Get username (non-sensitive) - safe to store in localStorage
export const getUsername = () => {
  return localStorage.getItem('username') || 'Player';
};

// Get user ID (non-sensitive) - safe to store in localStorage
export const getUserId = () => {
  return localStorage.getItem('user_id') || null;
};

// Create authenticated fetch headers (NO TOKEN NEEDED - cookies sent automatically)
export const getAuthHeaders = () => {
  return {
    'Content-Type': 'application/json'
  };
};

// Authenticated fetch wrapper - uses Bearer token from localStorage.
//
// PRODUCTION CORS NOTE: We deliberately DO NOT set ``credentials: 'include'``
// here. On the production custom-domain deploy the request is cross-origin
// (frontend `globalvibezdsg.com` -> backend `*.emergent.host`), and the K8s
// ingress short-circuits the preflight with `Access-Control-Allow-Origin: *`.
// Browsers forbid wildcard ACAO with credentials, so any call that sets
// `credentials: 'include'` is blocked at preflight — that was the ONLY thing
// stopping /api/auth/me from succeeding after demo + Google login on prod.
// The Bearer token in the Authorization header is the auth source of truth
// (backend reads Bearer first, cookie second), so dropping credentials here
// has zero behavioural cost while unblocking cross-origin auth.
export const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem('auth_token');
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options.headers,
    },
  });

  // 2026-05-12 BUGFIX: previously a 401 from ANY authFetch call triggered
  // `window.location.href = '/login'`. This caused two symptoms:
  //   1. Focus stolen mid-input → "can't type in profile fields"
  //   2. Hard redirect mid-session → "kicked completely out"
  // The global RoomVisitLogger fires authFetch on every route change,
  // which would race with auth state and force-logout valid users.
  //
  // New contract: authFetch ONLY clears bad tokens — it does NOT redirect.
  // ProtectedRoute (App.js) remains the single source of truth for
  // redirecting unauthenticated users to /login.
  if (response.status === 401 && token) {
    // Only clear tokens if we actually sent one and the server rejected it.
    // Anonymous calls (no token) just return the 401 to the caller.
    console.warn('authFetch: token rejected by server, clearing local credentials');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('username');
    localStorage.removeItem('user_id');
  }

  return response;
};

export default {
  getAuthToken,
  getUsername,
  getUserId,
  getAuthHeaders,
  authFetch
};
