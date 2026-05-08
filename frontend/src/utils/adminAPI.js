/**
 * Admin API Client
 * 
 * Shared utility for all GodMode admin API calls
 * Includes authentication and error handling
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Authenticated fetch wrapper for admin endpoints
 */
export const fetchWithAuth = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',  // Include HttpOnly cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  // If unauthorized, redirect to login
  if (response.status === 401) {
    window.location.href = '/vibe-vault-admin';
    throw new Error('Unauthorized');
  }
  
  return response;
};

/**
 * Admin API methods
 */
export const adminAPI = {
  /**
   * Authenticated fetch — accepts a relative path (/api/...) or full URL.
   * Returns the raw Response so callers can use .ok / .json() as needed.
   */
  fetchWithAuth: async (url, options = {}) => {
    const fullUrl =
      url.startsWith('http://') || url.startsWith('https://')
        ? url
        : `${BACKEND_URL}${url}`;
    return fetchWithAuth(fullUrl, options);
  },

  // Overview Stats
  getMasterStats: async () => {
    const res = await fetchWithAuth(`${BACKEND_URL}/api/admin/master-stats`);
    return res.json();
  },

  // Users
  getAllUsers: async (page = 1, limit = 20, search = '') => {
    const res = await fetchWithAuth(
      `${BACKEND_URL}/api/admin/all-users?page=${page}&limit=${limit}&search=${search}`
    );
    return res.json();
  },

  getUserDetail: async (userId) => {
    const res = await fetchWithAuth(`${BACKEND_URL}/api/admin/user-detail/${userId}`);
    return res.json();
  },

  banUser: async (userId, reason) => {
    const res = await fetchWithAuth(`${BACKEND_URL}/api/admin/ban-user`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, reason })
    });
    return res.json();
  },

  // Logout
  logout: async () => {
    const res = await fetchWithAuth(`${BACKEND_URL}/api/admin/vault-logout`, {
      method: 'POST'
    });
    return res.json();
  }
};

/**
 * CSV export helper (client-side)
 */
export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }
  const headers = Object.keys(data[0]).join(',');
  const rows = data
    .map((obj) => Object.values(obj).map((val) => `"${val}"`).join(','))
    .join('\n');
  const csv = headers + '\n' + rows;

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

export { BACKEND_URL };
export default adminAPI;
