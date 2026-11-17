import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, type LoginResponse } from '../services/api';

export interface AuthUser {
  id: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  departmentId: string;
  departmentCode: string;
  mustChangePassword?: boolean;
  phone?: string | null;
  notificationPreferences?: any;
  languagePreference?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateSessionToken: (newToken: string, updatedUserPartial?: Partial<AuthUser>) => void;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'mediflow_token';
const USER_KEY = 'mediflow_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUserProfile = useCallback(async () => {
    try {
      const res = await api.getMe();
      if (res?.data?.user) {
        const freshUser: AuthUser = {
          ...res.data.user,
          phone: res.data.user.phone ?? null,
          languagePreference: res.data.user.languagePreference ?? null,
        };
        setUser(freshUser);
        localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
      }
    } catch {
      // Handled by API 401 interceptor
    }
  }, []);

  // Restore and validate session on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        // Validate token against server — clears session if expired or revoked
        api.getMe()
          .then((res) => {
            if (res?.data?.user) {
              const freshUser: AuthUser = {
                ...res.data.user,
                phone: res.data.user.phone ?? null,
                languagePreference: res.data.user.languagePreference ?? null,
              };
              setUser(freshUser);
              localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
            }
          })
          .catch(() => {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            setToken(null);
            setUser(null);
          });
      } catch {
        // Corrupted storage — clear it
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }

    setIsLoading(false);
  }, []);

  // Intercept 403 PASSWORD_CHANGE_REQUIRED events across all API calls
  useEffect(() => {
    const handlePasswordChangeRequired = () => {
      setUser((prev) => (prev ? { ...prev, mustChangePassword: true } : prev));
    };

    window.addEventListener('mediflow:password-change-required', handlePasswordChangeRequired);
    return () => {
      window.removeEventListener('mediflow:password-change-required', handlePasswordChangeRequired);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response: LoginResponse = await api.login(email, password);
    const { token: newToken, user: userData } = response.data;

    const authUser: AuthUser = {
      ...userData,
      phone: userData.phone ?? null,
      languagePreference: userData.languagePreference ?? null,
    };

    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));

    setToken(newToken);
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    api.logoutUser().catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.clear();
    setToken(null);
    setUser(null);
  }, []);

  const updateSessionToken = useCallback((newToken: string, updatedUserPartial?: Partial<AuthUser>) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);

    setUser((prev) => {
      if (!prev) return null;
      const updated: AuthUser = {
        ...prev,
        ...updatedUserPartial,
        mustChangePassword: updatedUserPartial?.mustChangePassword ?? false,
      };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const mustChangePassword = Boolean(user?.mustChangePassword);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        mustChangePassword,
        login,
        logout,
        updateSessionToken,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
