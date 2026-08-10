import axios from 'axios';

const AUTH_TOKEN_KEY = 'jats.token';

// A hardcoded "http://localhost:8080/api" fallback breaks the moment this page is loaded from
// anywhere other than the machine running the backend - e.g. a teammate on the same LAN opening
// http://192.168.1.23:5173: "localhost" in *their* browser means *their own* machine, which has
// nothing listening on :8080. Defaulting to the hostname the page was actually served from (same
// scheme, backend's port) makes this work unmodified whether that's 127.0.0.1, localhost, or a LAN
// IP - VITE_API_BASE_URL still overrides this outright for anything else (a different port, HTTPS
// behind a reverse proxy, a real deployment, etc).
const DEFAULT_API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:8080/api`;

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 on any authenticated endpoint means the token is missing/expired/invalid — clear it and
// send the user back to login. Auth endpoints are excluded so a bad login/register attempt (which
// also returns 401/400) just surfaces as a form error instead of forcing a redirect.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = typeof error?.config?.url === 'string' && error.config.url.includes('/auth/');
    if (error?.response?.status === 401 && !isAuthEndpoint) {
      clearStoredToken();
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

export function getStoredToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}
