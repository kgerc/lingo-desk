import axios, { AxiosError } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Request timeout in milliseconds
const REQUEST_TIMEOUT = 30000; // 30 seconds

export const api = axios.create({
  baseURL: API_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Don't handle cancelled requests
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    // Handle timeout
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout:', error.config?.url);
      return Promise.reject(new Error('Przekroczono limit czasu żądania. Spróbuj ponownie.'));
    }

    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message);
      return Promise.reject(new Error('Błąd sieci. Sprawdź połączenie internetowe.'));
    }

    // Handle 401 - unauthorized
    if (error.response?.status === 401) {
      // Only redirect to login if we're not already on the login page
      // and this isn't a login request itself
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      const isOnLoginPage = window.location.pathname === '/login';

      if (!isLoginRequest && !isOnLoginPage) {
        localStorage.removeItem('token');
        // Use history API instead of hard redirect to preserve app state
        window.location.href = '/login';
      }
    }

    // Handle 429 - too many requests
    if (error.response?.status === 429) {
      console.warn('Rate limited:', error.config?.url);
      return Promise.reject(new Error('Zbyt wiele żądań. Poczekaj chwilę i spróbuj ponownie.'));
    }

    // Handle 500+ - server errors
    if (error.response?.status >= 500) {
      console.error('Server error:', error.response?.status, error.config?.url);
      return Promise.reject(new Error('Błąd serwera. Spróbuj ponownie później.'));
    }

    return Promise.reject(error);
  }
);

export default api;
