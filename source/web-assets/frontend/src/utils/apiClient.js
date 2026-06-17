/**
 * API Client - Standardized HTTP Request Wrapper
 * 
 * Provides consistent error handling, loading states, and toast notifications
 * across all API calls in the application.
 * 
 * Usage:
 * import { apiClient } from '@/utils/apiClient';
 * 
 * const data = await apiClient.post('/api/games/start', { gameType: 'uno' });
 * const user = await apiClient.get('/api/user/profile');
 */

import { toast } from 'sonner';
import { errorLogger } from './errorLogger';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * API Error Class
 */
export class APIError extends Error {
  constructor(message, statusCode, response = null) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

/**
 * Create fetch request with timeout
 */
const fetchWithTimeout = (url, options, timeout = 30000) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
};

/**
 * Base request handler
 */
const request = async (method, endpoint, options = {}) => {
  const {
    headers = {},
    body,
    credentials = 'include', // Include cookies by default
    showSuccessToast = false,
    showErrorToast = true,
    successMessage,
    timeout = 30000
  } = options;

  const url = endpoint.startsWith('http') ? endpoint : `${BACKEND_URL}${endpoint}`;

  const fetchOptions = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    credentials
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetchWithTimeout(url, fetchOptions, timeout);

    // Handle different status codes
    if (response.status === 401) {
      // Unauthorized - redirect to login
      if (showErrorToast) {
        toast.error('Session expired. Please login again.');
      }
      
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/auth')) {
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      }
      
      throw new APIError('Unauthorized', 401);
    }

    if (response.status === 403) {
      // Forbidden
      if (showErrorToast) {
        toast.error('Access denied. You don\'t have permission for this action.');
      }
      throw new APIError('Forbidden', 403);
    }

    if (response.status === 404) {
      // Not found
      if (showErrorToast) {
        toast.error('Resource not found.');
      }
      throw new APIError('Not Found', 404);
    }

    if (response.status === 500) {
      // Server error
      if (showErrorToast) {
        toast.error('Server error. Please try again later.');
      }
      errorLogger.logError(new Error('Server Error 500'), { endpoint, method });
      throw new APIError('Server Error', 500);
    }

    if (!response.ok) {
      // Other errors
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail || errorData.message || 'Request failed';
      
      if (showErrorToast) {
        toast.error(errorMessage);
      }
      
      throw new APIError(errorMessage, response.status, errorData);
    }

    // Success - parse response
    const data = await response.json();

    // Show success toast if requested
    if (showSuccessToast && successMessage) {
      toast.success(successMessage);
    }

    return data;

  } catch (error) {
    // Handle network errors
    if (error instanceof APIError) {
      // Already handled above
      throw error;
    }

    if (error.message === 'Request timeout') {
      if (showErrorToast) {
        toast.error('Request timed out. Please check your connection.');
      }
      errorLogger.logError(error, { endpoint, method, type: 'timeout' });
      throw new APIError('Timeout', 408);
    }

    // Network error (fetch failed)
    if (showErrorToast) {
      toast.error('Network error. Please check your connection.');
    }
    
    errorLogger.logError(error, { endpoint, method, type: 'network' });
    throw new APIError('Network Error', 0, error);
  }
};

/**
 * API Client - Public Interface
 */
export const apiClient = {
  /**
   * GET request
   */
  get: (endpoint, options = {}) => {
    return request('GET', endpoint, options);
  },

  /**
   * POST request
   */
  post: (endpoint, body = null, options = {}) => {
    return request('POST', endpoint, { ...options, body });
  },

  /**
   * PUT request
   */
  put: (endpoint, body = null, options = {}) => {
    return request('PUT', endpoint, { ...options, body });
  },

  /**
   * DELETE request
   */
  delete: (endpoint, options = {}) => {
    return request('DELETE', endpoint, options);
  },

  /**
   * PATCH request
   */
  patch: (endpoint, body = null, options = {}) => {
    return request('PATCH', endpoint, { ...options, body });
  }
};

/**
 * Convenience wrapper for showing loading toast during async operations
 * @param {string} endpoint - API endpoint
 * @param {string} loadingMessage - Message to show in loading toast
 * @param {object} options - Request options
 */
export const apiClientWithLoading = {
  get: async (endpoint, loadingMessage = 'Loading...', options = {}) => {
    const toastId = toast.loading(loadingMessage);
    try {
      const data = await apiClient.get(endpoint, options);
      toast.dismiss(toastId);
      return data;
    } catch (error) {
      toast.dismiss(toastId);
      throw error;
    }
  },

  post: async (endpoint, body = null, loadingMessage = 'Processing...', options = {}) => {
    const toastId = toast.loading(loadingMessage);
    try {
      const data = await apiClient.post(endpoint, body, options);
      toast.dismiss(toastId);
      return data;
    } catch (error) {
      toast.dismiss(toastId);
      throw error;
    }
  }
};

export default apiClient;
