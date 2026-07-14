/**
 * Secure Authentication Helper
 *
 * Production auth uses Bearer tokens in localStorage (`auth_token`), with
 * legacy keys (`token`) still read for older pages. Tokens are NOT cleared
 * on read — that previously logged users out mid-game (Spades chat).
 */

/** Non-destructive token reader (checks auth_token, then legacy token). */
export const getBearerToken = () => {
  return (
    localStorage.getItem('auth_token') ||
    localStorage.getItem('token') ||
    null
  );
};

/**
 * @deprecated Prefer getBearerToken(). Kept for callers that used getAuthToken;
 * does NOT clear storage (clearing was a production logout bug).
 */
export const getAuthToken = () => getBearerToken();

/** One-shot cleanup of obsolete duplicate keys — call from App boot only. */
export const clearLegacyTokenDupes = () => {
  const primary = localStorage.getItem('auth_token');
  const legacy = localStorage.getItem('token');
  if (primary && legacy && primary === legacy) {
    localStorage.removeItem('token');
  }
};

export const getUsername = () => {
  return localStorage.getItem('username') || 'Player';
};

/** Prefer user_id; fall back to camelCase userId used by some game pages. */
export const getUserId = () => {
  return (
    localStorage.getItem('user_id') ||
    localStorage.getItem('userId') ||
    null
  );
};

export const getAuthHeaders = () => {
  const token = getBearerToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * Authenticated fetch — Bearer from getBearerToken().
 * Does not hard-redirect on 401 (ProtectedRoute owns that).
 */
export const authFetch = async (url, options = {}) => {
  const token = getBearerToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  // Let the browser set multipart boundary when body is FormData.
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeader,
      ...options.headers,
    },
  });

  if (response.status === 401 && token) {
    console.warn('authFetch: token rejected by server, clearing local credentials');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('user_id');
    localStorage.removeItem('userId');
  }

  return response;
};

export default {
  getAuthToken,
  getBearerToken,
  clearLegacyTokenDupes,
  getUsername,
  getUserId,
  getAuthHeaders,
  authFetch,
};
