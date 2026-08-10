import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getCurrentUser } from '../api/users';
import { clearStoredToken, getStoredToken, storeToken } from '../api/client';
import type { AuthResponse, AuthenticatedUser } from '../types';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  /** True until the initial token-hydration check (GET /users/me) has resolved. */
  isLoading: boolean;
  login: (auth: AuthResponse) => void;
  logout: () => void;
  /** Re-fetches the current user, e.g. after a manager approves a pending account. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getStoredToken()) {
      setUser(null);
      return;
    }
    try {
      const summary = await getCurrentUser();
      setUser({ id: summary.id, email: summary.email, role: summary.role, status: summary.status });
    } catch {
      // Token is missing/expired/invalid — the response interceptor already clears it.
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Hydrates `user` from an existing token (e.g. after a page refresh). `refreshUser` is stable
    // (empty deps below) so this effectively only runs once, on mount.
    void refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const login = useCallback((auth: AuthResponse) => {
    storeToken(auth.token);
    setUser({ id: auth.id, email: auth.email, role: auth.role, status: auth.status });
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user ?? getStoredToken()),
      isLoading,
      login,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
