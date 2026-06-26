/**
 * Organization aioncore login — shared by OrgAuthContext and local login linkage (Phase 0 SSO).
 */

import { setOrgSessionToken } from '@/common/auth/orgAuthSession';
import { setSessionToken } from '@/common/auth/authSession';
import { syncOrgKnowledgeShadowAfterLogin } from '@/common/auth/orgKnowledgeShadowSync';
import { isUnifiedOrgSsoEnabled } from '@/common/auth/ssoMode';
import { backendFetchCredentials } from '@/common/adapter/httpBridge';
import { getOrgBaseUrl, isOrgServerConfigured } from '@/common/adapter/orgHttpBridge';

export const ORG_AUTH_UPDATED_EVENT = 'aionui:org-auth-updated';

const ORG_LOGIN_PATH = '/login';

export interface OrgLoginParams {
  username: string;
  password: string;
}

export interface OrgLoginUser {
  id: string;
  username: string;
  work_task_role?: 'manager' | 'employee';
}

export interface OrgLoginResult {
  success: boolean;
  message?: string;
  user?: OrgLoginUser;
  /** Phase 0: local shadow md synced from org API after login. */
  shadowSyncOk?: boolean;
  shadowSyncReason?: string;
}

async function writeOrgTokenToMain(token: string | null): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }
  const api = window as Window & { electronAPI?: { invokeIpc?: (channel: string, data?: unknown) => Promise<unknown> } };
  await api.electronAPI?.invokeIpc?.('org-auth-write-token', { token });
}

/** Clear org MCP token file (unified SSO logout). */
export async function clearOrgTokenOnDisk(): Promise<void> {
  await writeOrgTokenToMain(null);
}

function persistLoginTokens(token: string): void {
  if (isUnifiedOrgSsoEnabled()) {
    setSessionToken(token);
    setOrgSessionToken(token);
    return;
  }
  setOrgSessionToken(token);
}

export function notifyOrgAuthUpdated(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(ORG_AUTH_UPDATED_EVENT));
}

/**
 * POST org IdP /login, persist org JWT to sessionStorage and MCP token file.
 */
export async function performOrgLogin({ username, password }: OrgLoginParams): Promise<OrgLoginResult> {
  if (!isOrgServerConfigured()) {
    return { success: false, message: 'ORG_SERVER_URL is not configured' };
  }

  try {
    const response = await fetch(`${getOrgBaseUrl()}${ORG_LOGIN_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: backendFetchCredentials(),
      body: JSON.stringify({ username, password }),
    });

    const data = (await response.json()) as {
      success: boolean;
      message?: string;
      user?: OrgLoginUser;
      token?: string;
    };

    if (!response.ok || !data.success || !data.user) {
      return { success: false, message: data.message ?? 'Login failed' };
    }

    let shadowSyncOk: boolean | undefined;
    let shadowSyncReason: string | undefined;

    if (data.token) {
      persistLoginTokens(data.token);
      await writeOrgTokenToMain(data.token);
      const shadow = await syncOrgKnowledgeShadowAfterLogin();
      shadowSyncOk = shadow.ok;
      shadowSyncReason = shadow.reason;
    }

    notifyOrgAuthUpdated();
    return {
      success: true,
      user: data.user,
      shadowSyncOk,
      shadowSyncReason,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/** Phase 0 alias — silent org login after local login succeeds. */
export async function loginWithOrgLinkage(params: OrgLoginParams): Promise<OrgLoginResult> {
  return performOrgLogin(params);
}
