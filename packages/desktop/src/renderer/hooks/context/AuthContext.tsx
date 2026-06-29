import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { backendFetchCredentials, getBaseUrl } from '@/common/adapter/httpBridge';
import { performOrgLogin, clearOrgTokenOnDisk } from '@/common/auth/orgAuthLogin';
import { getSessionToken, setSessionToken } from '@/common/auth/authSession';
import {
  AUTH_SESSION_INVALIDATED_EVENT,
  invalidateAuthSession,
  type AuthInvalidationReason,
} from '@/common/auth/authInvalidation';
import { isDesktopBypassAuth, isDesktopRuntime, shouldForceRelogin } from '@/common/auth/desktopAuthFlags';
import { isUnifiedOrgSsoEnabled } from '@/common/auth/ssoMode';
// M6: CSRF removed with legacy webserver — stub functions for compatibility, re-implement in M7
const withCsrfToken = <T extends Record<string, unknown>>(data: T): T => data;
const hasValidCsrfToken = (): boolean => true;
const clearCookie = (_name: string, _path?: string): void => {};
const CSRF_COOKIE_NAME = 'csrf-token';

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

export interface AuthUser {
  id: string;
  username: string;
  work_task_role?: 'manager' | 'employee';
}

interface LoginParams {
  username: string;
  password: string;
  remember?: boolean;
}

type LoginErrorCode =
  | 'invalidCredentials'
  | 'tooManyAttempts'
  | 'serverError'
  | 'networkError'
  | 'csrfError'
  | 'unknown';

function mapOrgLoginErrorCode(message?: string): LoginErrorCode {
  if (!message) {
    return 'unknown';
  }
  const lower = message.toLowerCase();
  if (
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('fetch failed') ||
    lower.includes('econnrefused')
  ) {
    return 'networkError';
  }
  if (lower.includes('not configured')) {
    return 'serverError';
  }
  return 'invalidCredentials';
}

interface LoginResult {
  success: boolean;
  message?: string;
  code?: LoginErrorCode;
  shouldClearCache?: boolean;
}

interface AuthContextValue {
  ready: boolean;
  user: AuthUser | null;
  status: AuthStatus;
  login: (params: LoginParams) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  clearAuthCache: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_USER_ENDPOINT = '/api/auth/user';

const DESKTOP_DEFAULT_USER: AuthUser = {
  id: 'system_default_user',
  username: 'system',
  work_task_role: 'manager',
};

// Clear expired auth cache including cookies and localStorage
// 清除过期的认证缓存，包括 Cookie 和 localStorage
function clearAuthCache(): void {
  if (typeof window === 'undefined') return;

  try {
    // Clear CSRF cookie
    clearCookie(CSRF_COOKIE_NAME);
    clearCookie(CSRF_COOKIE_NAME, '/');

    // Clear localStorage auth-related items
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('auth') || key.includes('csrf') || key.includes('token'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.error('Failed to clear auth cache:', error);
  }
}

async function fetchCurrentUser(signal?: AbortSignal): Promise<AuthUser | null> {
  try {
    const bearer = getSessionToken();
    const response = await fetch(`${getBaseUrl()}${AUTH_USER_ENDPOINT}`, {
      method: 'GET',
      credentials: backendFetchCredentials(),
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
      signal,
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      success: boolean;
      user?: AuthUser;
    };
    if (data.success && data.user) {
      return {
        ...data.user,
        work_task_role: data.user.work_task_role ?? 'manager',
      };
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return null;
    }
    console.error('Failed to fetch current user:', error);
  }

  return null;
}

function applyDesktopBypass(setUser: (u: AuthUser) => void, setStatus: (s: AuthStatus) => void, setReady: (r: boolean) => void) {
  setStatus('authenticated');
  setUser(DESKTOP_DEFAULT_USER);
  setReady(true);
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [ready, setReady] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const forceReloginHandledRef = useRef(false);

  const refresh = useCallback(async () => {
    if (isDesktopRuntime()) {
      if (isDesktopBypassAuth()) {
        applyDesktopBypass(setUser, setStatus, setReady);
        return;
      }

      if (shouldForceRelogin() && !forceReloginHandledRef.current) {
        forceReloginHandledRef.current = true;
        invalidateAuthSession('force-relogin');
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus('checking');

      const currentUser = await fetchCurrentUser(controller.signal);
      if (currentUser) {
        setUser(currentUser);
        setStatus('authenticated');
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }
      setReady(true);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('checking');

    const currentUser = await fetchCurrentUser(controller.signal);
    if (currentUser) {
      setUser(currentUser);
      setStatus('authenticated');
    } else {
      setUser(null);
      setStatus('unauthenticated');
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      abortRef.current?.abort();
    };
  }, [refresh]);

  useEffect(() => {
    const onInvalidated = (event: Event) => {
      const reason = (event as CustomEvent<{ reason?: AuthInvalidationReason }>).detail?.reason;
      if (isDesktopRuntime() && isDesktopBypassAuth() && reason !== 'logout') {
        return;
      }
      setUser(null);
      setStatus('unauthenticated');
      setReady(true);
    };
    window.addEventListener(AUTH_SESSION_INVALIDATED_EVENT, onInvalidated);
    return () => window.removeEventListener(AUTH_SESSION_INVALIDATED_EVENT, onInvalidated);
  }, []);

  const login = useCallback(async ({ username, password, remember }: LoginParams): Promise<LoginResult> => {
    try {
      if (isDesktopRuntime()) {
        if (isDesktopBypassAuth()) {
          applyDesktopBypass(setUser, setStatus, setReady);
          return { success: true };
        }

        if (isUnifiedOrgSsoEnabled()) {
          const result = await performOrgLogin({ username, password });
          if (result.success && result.user) {
            setUser({
              id: result.user.id,
              username: result.user.username,
              work_task_role: result.user.work_task_role ?? 'employee',
            });
            setStatus('authenticated');
            setReady(true);
            return { success: true };
          }
          return {
            success: false,
            message: result.message ?? 'Login failed',
            code: mapOrgLoginErrorCode(result.message),
          };
        }

        const response = await fetch(`${getBaseUrl()}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: backendFetchCredentials(),
          body: JSON.stringify({ username, password, remember }),
        });

        const data = (await response.json()) as {
          success: boolean;
          message?: string;
          user?: AuthUser;
          token?: string;
        };

        if (!response.ok || !data.success || !data.user) {
          let code: LoginErrorCode = 'unknown';
          if (response.status === 401) code = 'invalidCredentials';
          else if (response.status === 429) code = 'tooManyAttempts';
          else if (response.status >= 500) code = 'serverError';
          return { success: false, message: data.message ?? 'Login failed', code };
        }

        if (data.token) {
          setSessionToken(data.token);
        }

        setUser({
          ...data.user,
          work_task_role: data.user.work_task_role ?? 'manager',
        });
        setStatus('authenticated');
        setReady(true);
        return { success: true };
      }

      // Check CSRF token availability before login
      // If token is missing, clear cache and inform user
      const csrfTokenValid = hasValidCsrfToken();
      if (!csrfTokenValid) {
        console.warn('CSRF token missing or invalid, clearing cache');
        clearAuthCache();
        // Allow login to proceed anyway - server will set new token
      }

      // P1 安全修复：登录请求需要 CSRF Token / P1 Security fix: Login needs CSRF token
      // Backend route is /login; web-host's static-server explicitly proxies it.
      const response = await fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(withCsrfToken({ username, password, remember })),
      });

      const data = (await response.json()) as {
        success: boolean;
        message?: string;
        user?: AuthUser;
      };

      if (!response.ok || !data.success || !data.user) {
        let code: LoginErrorCode = 'unknown';
        let message = data?.message ?? 'Login failed';
        let shouldClearCache = false;

        if (response.status === 401) {
          code = 'invalidCredentials';
        } else if (response.status === 403) {
          // CSRF validation failed - clear cache
          code = 'csrfError';
          message = 'Security token expired. Please try again.';
          shouldClearCache = true;
        } else if (response.status === 429) {
          code = 'tooManyAttempts';
        } else if (response.status >= 500) {
          code = 'serverError';
        } else if (!csrfTokenValid) {
          // If we knew CSRF was invalid and login failed, suggest cache clear
          code = 'csrfError';
          message = 'Login failed due to cached data. Please clear your browser cache and try again.';
          shouldClearCache = true;
        }

        // Clear cache on CSRF-related errors
        if (shouldClearCache) {
          clearAuthCache();
        }

        return {
          success: false,
          message,
          code,
          shouldClearCache,
        };
      }

      setUser(data.user);
      setStatus('authenticated');
      setReady(true);

      // Re-enable WebSocket reconnection after successful login (WebUI mode only)
      if (typeof window !== 'undefined' && (window as any).__websocketReconnect) {
        (window as any).__websocketReconnect();
      }

      return { success: true };
    } catch (error) {
      console.error('Login request failed:', error);

      // Check if error is related to CSRF token parsing
      const errorMessage = (error as Error).message;
      if (errorMessage?.includes('parse') || errorMessage?.includes('csrf') || errorMessage?.includes('cookie')) {
        // CSRF or cookie parsing error - clear cache
        clearAuthCache();
        return {
          success: false,
          message: 'Login failed due to cached data. Please clear your browser cache and try again.',
          code: 'csrfError',
          shouldClearCache: true,
        };
      }

      return {
        success: false,
        message: 'Network error. Please try again.',
        code: 'networkError',
      };
    }
  }, []);

  const logout = useCallback(async () => {
    if (isDesktopRuntime()) {
      if (isDesktopBypassAuth()) {
        applyDesktopBypass(setUser, setStatus, setReady);
        return;
      }

      try {
        const bearer = getSessionToken();
        await fetch(`${getBaseUrl()}/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          },
          credentials: backendFetchCredentials(),
          body: JSON.stringify({}),
        });
      } catch (error) {
        console.error('Logout request failed:', error);
      } finally {
        await clearOrgTokenOnDisk();
        invalidateAuthSession('logout');
        setUser(null);
        setStatus('unauthenticated');
        setReady(true);
      }
      return;
    }

    try {
      await fetch('/logout', {
        method: 'POST',
        // Logout also needs CSRF token / 登出同样需要 CSRF Token
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(withCsrfToken({})),
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      setUser(null);
      setStatus('unauthenticated');
      // Clear cache on logout for security
      clearAuthCache();
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      user,
      status,
      login,
      logout,
      refresh,
      clearAuthCache,
    }),
    [login, logout, ready, refresh, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
