/**
 * Organization aioncore auth — separate JWT from local AuthContext.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { clearOrgSessionToken, getOrgSessionToken } from '@/common/auth/orgAuthSession';
import { ORG_AUTH_UPDATED_EVENT, performOrgLogin, type OrgLoginParams } from '@/common/auth/orgAuthLogin';
import {
  WANDING_BUSINESS_KNOWLEDGE_SLUG,
  syncWandingBusinessKnowledgeShadow,
} from '@/common/auth/orgKnowledgeShadowSync';
import { backendFetchCredentials } from '@/common/adapter/httpBridge';
import { getOrgBaseUrl, getOrgBearerToken, isOrgServerConfigured } from '@/common/adapter/orgHttpBridge';
import type { AuthUser } from '@/renderer/hooks/context/AuthContext';

type OrgAuthStatus = 'idle' | 'checking' | 'authenticated' | 'unauthenticated' | 'unconfigured';

interface OrgAuthContextValue {
  configured: boolean;
  orgUser: AuthUser | null;
  orgStatus: OrgAuthStatus;
  orgLogin: (params: OrgLoginParams) => Promise<{ success: boolean; message?: string }>;
  orgLogout: () => Promise<void>;
  refreshOrgAuth: () => Promise<void>;
}

const OrgAuthContext = createContext<OrgAuthContextValue | undefined>(undefined);

const ORG_AUTH_USER_PATH = '/api/auth/user';
const ORG_KNOWLEDGE_SHADOW_SYNC_INTERVAL_MS = 60_000;

async function writeOrgTokenToMain(token: string | null): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }
  const api = window as Window & { electronAPI?: { invokeIpc?: (channel: string, data?: unknown) => Promise<unknown> } };
  await api.electronAPI?.invokeIpc?.('org-auth-write-token', { token });
}

async function fetchOrgUser(signal?: AbortSignal): Promise<AuthUser | null> {
  if (!isOrgServerConfigured()) {
    return null;
  }
  try {
    const bearer = getOrgBearerToken();
    const response = await fetch(`${getOrgBaseUrl()}${ORG_AUTH_USER_PATH}`, {
      method: 'GET',
      credentials: backendFetchCredentials(),
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
      signal,
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { success: boolean; user?: AuthUser };
    return data.success && data.user ? data.user : null;
  } catch {
    return null;
  }
}

export const OrgAuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const configured = isOrgServerConfigured();
  const [orgUser, setOrgUser] = useState<AuthUser | null>(null);
  const [orgStatus, setOrgStatus] = useState<OrgAuthStatus>(configured ? 'checking' : 'unconfigured');
  const abortRef = useRef<AbortController | null>(null);

  const refreshOrgAuth = useCallback(async () => {
    if (!isOrgServerConfigured()) {
      setOrgUser(null);
      setOrgStatus('unconfigured');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setOrgStatus('checking');

    const user = await fetchOrgUser(controller.signal);
    if (user) {
      setOrgUser(user);
      setOrgStatus('authenticated');
    } else {
      clearOrgSessionToken();
      void writeOrgTokenToMain(null);
      setOrgUser(null);
      setOrgStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    void refreshOrgAuth();
    return () => abortRef.current?.abort();
  }, [refreshOrgAuth]);

  useEffect(() => {
    const onOrgAuthUpdated = () => {
      void refreshOrgAuth();
    };
    window.addEventListener(ORG_AUTH_UPDATED_EVENT, onOrgAuthUpdated);
    return () => window.removeEventListener(ORG_AUTH_UPDATED_EVENT, onOrgAuthUpdated);
  }, [refreshOrgAuth]);

  useEffect(() => {
    if (orgStatus !== 'authenticated') {
      return;
    }

    let disposed = false;
    let syncing = false;

    const sync = async () => {
      if (disposed || syncing || !navigator.onLine) {
        return;
      }
      syncing = true;
      try {
        await syncWandingBusinessKnowledgeShadow();
      } finally {
        syncing = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void sync();
      }
    };

    const orgWsUrl = getOrgBaseUrl().replace(/^http/i, 'ws') + '/ws';
    const orgToken = getOrgBearerToken();
    let socket: WebSocket | null = null;
    try {
      socket = orgToken ? new WebSocket(orgWsUrl, orgToken) : new WebSocket(orgWsUrl);
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as {
            name?: string;
            data?: { slug?: string; version?: number };
          };
          if (
            message.name === 'org-knowledge.updated' &&
            message.data?.slug === WANDING_BUSINESS_KNOWLEDGE_SLUG
          ) {
            void sync();
          }
        } catch {
          /* ignore malformed realtime messages */
        }
      };
    } catch (error) {
      console.warn('[orgKnowledgeShadowSync] org websocket unavailable', error);
    }

    void sync();
    const intervalId = window.setInterval((): void => void sync(), ORG_KNOWLEDGE_SHADOW_SYNC_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      disposed = true;
      socket?.close();
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [orgStatus]);



  const orgLogin = useCallback(async (params: OrgLoginParams): Promise<{ success: boolean; message?: string }> => {
    const result = await performOrgLogin(params);
    if (result.success && result.user) {
      setOrgUser(result.user);
      setOrgStatus('authenticated');
      return { success: true };
    }
    return { success: false, message: result.message ?? 'Login failed' };
  }, []);

  const orgLogout = useCallback(async () => {
    clearOrgSessionToken();
    await writeOrgTokenToMain(null);
    setOrgUser(null);
    setOrgStatus(isOrgServerConfigured() ? 'unauthenticated' : 'unconfigured');
  }, []);

  return (
    <OrgAuthContext.Provider
      value={{ configured, orgUser, orgStatus, orgLogin, orgLogout, refreshOrgAuth }}
    >
      {children}
    </OrgAuthContext.Provider>
  );
};

export function useOrgAuth(): OrgAuthContextValue {
  const ctx = useContext(OrgAuthContext);
  if (!ctx) {
    throw new Error('useOrgAuth must be used within OrgAuthProvider');
  }
  return ctx;
}
