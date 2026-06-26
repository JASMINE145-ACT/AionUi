/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loginWithOrgLinkage,
  performOrgLogin,
} from '@/common/auth/orgAuthLogin';
import { getOrgSessionToken, setOrgSessionToken } from '@/common/auth/orgAuthSession';
import { getSessionToken, setSessionToken } from '@/common/auth/authSession';
import { syncOrgKnowledgeShadowAfterLogin } from '@/common/auth/orgKnowledgeShadowSync';

vi.mock('@/common/auth/orgKnowledgeShadowSync', () => ({
  syncOrgKnowledgeShadowAfterLogin: vi.fn().mockResolvedValue({ ok: true }),
}));

describe('orgAuthLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setOrgSessionToken(null);
    delete (globalThis as { __orgServerUrl?: string }).__orgServerUrl;
    (globalThis as { window?: { __orgServerUrl?: string; electronAPI?: unknown; dispatchEvent?: () => boolean } }).window = {
      __orgServerUrl: 'http://127.0.0.1:13401',
      electronAPI: { invokeIpc: vi.fn().mockResolvedValue({ success: true }) },
      dispatchEvent: vi.fn(() => true),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setOrgSessionToken(null);
    delete (globalThis as { __orgServerUrl?: string }).__orgServerUrl;
    delete (globalThis as { window?: unknown }).window;
  });

  it('returns failure when org server is not configured', async () => {
    delete (globalThis as { window?: { __orgServerUrl?: string } }).window?.__orgServerUrl;
    const result = await performOrgLogin({ username: 'u', password: 'p' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('not configured');
  });

  it('stores org token and dispatches update event on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        token: 'org-jwt-token',
        user: { id: 'user-1', username: 'alice' },
      }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const result = await loginWithOrgLinkage({ username: 'alice', password: 'secret' });

      expect(result.success).toBe(true);
      expect(getOrgSessionToken()).toBe('org-jwt-token');
      expect(syncOrgKnowledgeShadowAfterLogin).toHaveBeenCalledOnce();
      expect(result.shadowSyncOk).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:13401/login',
        expect.objectContaining({ method: 'POST' })
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns failure without storing token when org login fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, message: 'Invalid username or password' }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const result = await performOrgLogin({ username: 'bad', password: 'bad' });

      expect(result.success).toBe(false);
      expect(getOrgSessionToken()).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('stores unified token in session and org keys when SSO mode is enabled', async () => {
    (globalThis as { window?: { __ssoMode?: string } }).window = {
      ...(globalThis as { window?: object }).window,
      __ssoMode: 'org-idp',
      __orgServerUrl: 'http://127.0.0.1:13401',
      electronAPI: { invokeIpc: vi.fn().mockResolvedValue({ success: true }) },
      dispatchEvent: vi.fn(() => true),
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        token: 'unified-jwt',
        user: { id: 'user-1', username: 'alice' },
      }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const result = await performOrgLogin({ username: 'alice', password: 'secret' });
      expect(result.success).toBe(true);
      expect(getSessionToken()).toBe('unified-jwt');
      expect(getOrgSessionToken()).toBe('unified-jwt');
    } finally {
      globalThis.fetch = originalFetch;
      setSessionToken(null);
    }
  });
});
