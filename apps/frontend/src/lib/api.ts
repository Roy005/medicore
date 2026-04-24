import axios from 'axios';

const rawUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const baseUrl = rawUrl.endsWith('/api/v1') ? rawUrl : `${rawUrl}/api/v1`;

const api = axios.create({
  baseURL: baseUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT from localStorage
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        const isAuthRoute =
          window.location.pathname.startsWith('/login') ||
          window.location.pathname.startsWith('/register');
        if (!isAuthRoute) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
