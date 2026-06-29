/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loginWithOrgLinkage,
  performOrgLogin,
} from '@/common/auth/orgAuthLogin';
import { ORG_HTTP_REQUEST_CHANNEL } from '@/common/adapter/orgHttpBridge';
import { getOrgSessionToken, setOrgSessionToken } from '@/common/auth/orgAuthSession';
import { getSessionToken, setSessionToken } from '@/common/auth/authSession';
import { syncOrgKnowledgeShadowAfterLogin } from '@/common/auth/orgKnowledgeShadowSync';

vi.mock('@/common/auth/orgKnowledgeShadowSync', () => ({
  syncOrgKnowledgeShadowAfterLogin: vi.fn().mockResolvedValue({ ok: true }),
}));

function mockOrgLoginIpc(
  response: {
    ok: boolean;
    status: number;
    json?: unknown;
    text?: string;
    error?: string;
  }
) {
  return vi.fn(async (channel: string, payload?: unknown) => {
    if (channel === ORG_HTTP_REQUEST_CHANNEL) {
      expect(payload).toEqual(
        expect.objectContaining({ method: 'POST', path: '/login' })
      );
      return response;
    }
    return { success: true };
  });
}

describe('orgAuthLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setOrgSessionToken(null);
    delete (globalThis as { __orgServerUrl?: string }).__orgServerUrl;
    (globalThis as { window?: { __orgServerUrl?: string; electronAPI?: unknown; dispatchEvent?: () => boolean } }).window = {
      __orgServerUrl: 'http://127.0.0.1:13401',
      electronAPI: { invokeIpc: mockOrgLoginIpc({
        ok: true,
        status: 200,
        json: {
          success: true,
          token: 'org-jwt-token',
          user: { id: 'user-1', username: 'alice' },
        },
      }) },
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
    delete (globalThis as { window?: { __orgServerUrl?: string; electronAPI?: unknown } }).window?.__orgServerUrl;
    (globalThis as { window?: { electronAPI?: unknown } }).window!.electronAPI = undefined;
    const result = await performOrgLogin({ username: 'u', password: 'p' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('not configured');
  });

  it('stores org token and dispatches update event on success', async () => {
    const result = await loginWithOrgLinkage({ username: 'alice', password: 'secret' });

    expect(result.success).toBe(true);
    expect(getOrgSessionToken()).toBe('org-jwt-token');
    expect(syncOrgKnowledgeShadowAfterLogin).toHaveBeenCalledOnce();
    expect(result.shadowSyncOk).toBe(true);
    expect(window.electronAPI?.invokeIpc).toHaveBeenCalledWith(
      ORG_HTTP_REQUEST_CHANNEL,
      expect.objectContaining({
        method: 'POST',
        path: '/login',
        body: { username: 'alice', password: 'secret' },
      })
    );
  });

  it('returns failure without storing token when org login fails', async () => {
    (globalThis as { window?: { electronAPI?: { invokeIpc: ReturnType<typeof vi.fn> } } }).window = {
      ...(globalThis as { window?: object }).window,
      electronAPI: {
        invokeIpc: mockOrgLoginIpc({
          ok: false,
          status: 401,
          json: { success: false, message: 'Invalid username or password' },
        }),
      },
    };

    const result = await performOrgLogin({ username: 'bad', password: 'bad' });

    expect(result.success).toBe(false);
    expect(getOrgSessionToken()).toBeNull();
  });

  it('stores unified token in session and org keys when SSO mode is enabled', async () => {
    (globalThis as { window?: { __ssoMode?: string; electronAPI?: { invokeIpc: ReturnType<typeof vi.fn> } } }).window = {
      ...(globalThis as { window?: object }).window,
      __ssoMode: 'org-idp',
      electronAPI: {
        invokeIpc: mockOrgLoginIpc({
          ok: true,
          status: 200,
          json: {
            success: true,
            token: 'unified-jwt',
            user: { id: 'user-1', username: 'alice' },
          },
        }),
      },
    };

    const result = await performOrgLogin({ username: 'alice', password: 'secret' });
    expect(result.success).toBe(true);
    expect(getSessionToken()).toBe('unified-jwt');
    expect(getOrgSessionToken()).toBe('unified-jwt');
    setSessionToken(null);
  });
});
