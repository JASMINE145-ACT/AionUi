/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as orgAuthSession from '@/common/auth/orgAuthSession';
import * as authSession from '@/common/auth/authSession';
import * as ssoMode from '@/common/auth/ssoMode';
import {
  getOrgBaseUrl,
  getOrgBearerToken,
  isOrgServerConfigured,
  orgHttpDelete,
  orgHttpRequest,
} from '@/common/adapter/orgHttpBridge';

describe('orgHttpBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as { __orgServerUrl?: string }).__orgServerUrl;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as { __orgServerUrl?: string }).__orgServerUrl;
  });

  it('getOrgBaseUrl reads window.__orgServerUrl', () => {
    (globalThis as { window?: { __orgServerUrl?: string } }).window = { __orgServerUrl: 'http://192.168.1.10:13401/' };
    expect(getOrgBaseUrl()).toBe('http://192.168.1.10:13401');
    delete (globalThis as { window?: unknown }).window;
  });

  it('isOrgServerConfigured is false when URL missing', () => {
    expect(isOrgServerConfigured()).toBe(false);
  });

  it('orgHttpRequest throws when org URL is not configured', async () => {
    await expect(orgHttpRequest('GET', '/api/org-knowledge')).rejects.toThrow('ORG_SERVER_URL is not configured');
  });

  it('orgHttpRequest sends Bearer org token and unwraps data envelope', async () => {
    (globalThis as { __orgServerUrl?: string }).__orgServerUrl = 'http://org.local:13401';
    const tokenSpy = vi.spyOn(orgAuthSession, 'getOrgSessionToken').mockReturnValue('org-test-token');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: [{ slug: 'wanding_business_knowledge' }] }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await orgHttpRequest('GET', '/api/org-knowledge');
    expect(result).toEqual([{ slug: 'wanding_business_knowledge' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://org.local:13401/api/org-knowledge',
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        headers: expect.objectContaining({ Authorization: 'Bearer org-test-token' }),
      })
    );
    tokenSpy.mockRestore();
  });

  it('orgHttpRequest uses IPC proxy in Electron renderer', async () => {
    (globalThis as { __orgServerUrl?: string }).__orgServerUrl = 'http://org.local:13401';
    (globalThis as { window?: { electronAPI?: { invokeIpc: ReturnType<typeof vi.fn> } } }).window = {
      electronAPI: {
        invokeIpc: vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: { success: true, data: [{ slug: 'wanding_business_knowledge' }] },
          contentType: 'application/json',
        }),
      },
    };
    vi.spyOn(orgAuthSession, 'getOrgSessionToken').mockReturnValue('org-test-token');

    const fetchMock = vi.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      const result = await orgHttpRequest('GET', '/api/org-knowledge');
      expect(result).toEqual([{ slug: 'wanding_business_knowledge' }]);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(window.electronAPI?.invokeIpc).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      delete (globalThis as { window?: unknown }).window;
    }
  });

  it('getOrgBearerToken falls back to session token in unified SSO mode', () => {
    vi.spyOn(orgAuthSession, 'getOrgSessionToken').mockReturnValue(null);
    vi.spyOn(ssoMode, 'isUnifiedOrgSsoEnabled').mockReturnValue(true);
    vi.spyOn(authSession, 'getSessionToken').mockReturnValue('unified-jwt-token');
    expect(getOrgBearerToken()).toBe('unified-jwt-token');
  });

  it('orgHttpDelete sends DELETE via orgHttpRequest', async () => {
    (globalThis as { __orgServerUrl?: string }).__orgServerUrl = 'http://org.local:13401';
    vi.spyOn(orgAuthSession, 'getOrgSessionToken').mockReturnValue('org-test-token');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: null }),
      text: async () => '',
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await orgHttpDelete<void, { id: string }>((p) => `/api/work-tasks/${p.id}`).invoke({ id: 'wt_1' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://org.local:13401/api/work-tasks/wt_1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});
