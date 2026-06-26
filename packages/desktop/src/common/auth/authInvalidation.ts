/**
 * Central auth session invalidation — stale JWT after reinstall / secret rotation.
 * Spec: .trellis/spec/integration/aioncore-work-tasks.md (local JWT + desktop Bearer)
 */

import { clearSessionToken } from '@/common/auth/authSession';
import { clearOrgSessionToken } from '@/common/auth/orgAuthSession';

export const AUTH_SESSION_INVALIDATED_EVENT = 'aionui:auth-session-invalidated';

export type AuthInvalidationReason = 'http-401' | 'refresh-401' | 'force-relogin' | 'logout';

export function invalidateAuthSession(reason: AuthInvalidationReason = 'http-401'): void {
  clearSessionToken();
  clearOrgSessionToken();

  if (typeof window !== 'undefined') {
    const api = window as Window & { electronAPI?: { invokeIpc?: (channel: string, data?: unknown) => Promise<unknown> } };
    void api.electronAPI?.invokeIpc?.('org-auth-write-token', { token: null });
  }

  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(AUTH_SESSION_INVALIDATED_EVENT, {
      detail: { reason },
    })
  );
}

export function shouldInvalidateAuthOnHttp401(path: string): boolean {
  const normalized = path.split('?')[0] ?? path;
  if (normalized === '/login' || normalized === '/logout') {
    return false;
  }
  return true;
}
