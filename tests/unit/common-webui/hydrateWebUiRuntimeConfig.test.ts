/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { hydrateWebUiRuntimeConfig } from '@/common/webui/hydrateWebUiRuntimeConfig';

describe('hydrateWebUiRuntimeConfig', () => {
  beforeEach(() => {
    delete window.__orgServerUrl;
    delete window.__ssoMode;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete window.__orgServerUrl;
    delete window.__ssoMode;
  });

  it('no-ops in Electron renderer (window.__backendPort set)', async () => {
    window.__backendPort = 13400;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await hydrateWebUiRuntimeConfig();

    expect(fetchMock).not.toHaveBeenCalled();
    delete window.__backendPort;
  });

  it('sets window.__orgServerUrl and __ssoMode from /api/webui/runtime-config', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ orgServerUrl: 'http://org.test:13401/', ssoMode: 'org-idp' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await hydrateWebUiRuntimeConfig();

    expect(fetchMock).toHaveBeenCalledWith('/api/webui/runtime-config', { credentials: 'include' });
    expect(window.__orgServerUrl).toBe('http://org.test:13401');
    expect(window.__ssoMode).toBe('org-idp');
  });

  it('ignores failed runtime-config fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await hydrateWebUiRuntimeConfig();

    expect(window.__orgServerUrl).toBeUndefined();
    expect(window.__ssoMode).toBeUndefined();
  });
});
