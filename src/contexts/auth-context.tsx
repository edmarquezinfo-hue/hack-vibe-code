/**
 * Enhanced Auth Context
 * Provides OAuth + Email/Password authentication with backward compatibility
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';

interface User {
  id: string;
  email: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  bio?: string;
  isAnonymous: boolean;
  emailVerified?: boolean;
  provider?: 'google' | 'github' | 'email';
  createdAt?: Date;
  lastActiveAt?: Date;
  theme?: 'light' | 'dark' | 'system';
  timezone?: string;
}

interface AuthSession {
  id: string;
  expiresAt: Date;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // OAuth login method
  login: (provider: 'google' | 'github') => void;
  
  // Email/password login method
  loginWithEmail: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { email: string; password: string; name?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Token refresh interval - refresh every 10 minutes
const TOKEN_REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour (check less frequently since tokens last 24h)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  
  // Ref to store the refresh timer
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // API helper for authenticated requests (cookie-based)
  const apiRequest = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    return fetch(url, {
      ...options,
      credentials: 'include', // Always include cookies
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }, []);

  // Check authentication status (uses existing /api/auth/profile endpoint)
  const checkAuth = useCallback(async () => {
    try {
      const response = await apiRequest('/api/auth/profile');
      
      if (response.ok) {
        const data = await response.json();
        if (data.data?.user) {
          setUser(data.data.user);
          setToken(null); // Profile endpoint doesn't return token, cookies are used
          setSession({
            id: data.data.sessionId || data.data.user.id,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours expiry
          });
          
          // Setup token refresh
          setupTokenRefresh();
        } else {
          setUser(null);
          setToken(null);
          setSession(null);
        }
      } else {
        setUser(null);
        setToken(null);
        setSession(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      setToken(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, [apiRequest]);

  // Setup automatic session validation (cookie-based)
  const setupTokenRefresh = useCallback(() => {
    // Clear any existing timer
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }

    // Set up session validation timer - less frequent since cookies handle refresh
    refreshTimerRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/auth/profile', {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          // Session invalid, user needs to login again
          setUser(null);
          setToken(null);
          setSession(null);
          clearInterval(refreshTimerRef.current!);
        }
      } catch (error) {
        console.error('Session validation failed:', error);
      }
    }, TOKEN_REFRESH_INTERVAL);
  }, []);

  // Cleanup refresh timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, []);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // OAuth login method
  const login = useCallback((provider: 'google' | 'github') => {
    // Redirect to OAuth provider
    window.location.href = `/api/auth/oauth/${provider}`;
  }, []);

  // Email/password login
  const loginWithEmail = useCallback(async (credentials: { email: string; password: string }) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.data.user);
        setToken(null); // Using cookies for authentication
        setSession({
          id: data.data.session?.id || data.data.user.id,
          expiresAt: new Date(Date.now() + (data.data.expiresIn || 24 * 60 * 60) * 1000),
        });
        setupTokenRefresh();
        navigate('/');
      } else {
        setError(data.error?.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  }, [navigate, setupTokenRefresh]);

  // Register new user
  const register = useCallback(async (data: { email: string; password: string; name?: string }) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        setUser(responseData.data.user);
        setToken(null); // Using cookies for authentication
        setSession({
          id: responseData.data.session?.id || responseData.data.user.id,
          expiresAt: new Date(Date.now() + (responseData.data.expiresIn || 24 * 60 * 60) * 1000),
        });
        setupTokenRefresh();
        navigate('/');
      } else {
        setError(responseData.error?.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('An error occurred during registration');
    } finally {
      setIsLoading(false);
    }
  }, [navigate, setupTokenRefresh]);

  // Logout
  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear state regardless of API response
      setUser(null);
      setToken(null);
      setSession(null);
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      navigate('/');
    }
  }, [apiRequest, navigate]);

  // Refresh user profile
  const refreshUser = useCallback(async () => {
    await checkAuth();
  }, [checkAuth]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    token,
    session,
    isAuthenticated: !!user,
    isLoading,
    error,
    login, // OAuth method
    loginWithEmail, // Email/password method
    register,
    logout,
    refreshUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper hook for protected routes
export function useRequireAuth(redirectTo = '/') {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate(redirectTo);
    }
  }, [isAuthenticated, isLoading, navigate, redirectTo]);

  return { isAuthenticated, isLoading };
}