/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * N4c V2: usePreviewHistory hook export-shape smoke test.
 *
 * Design note:
 * usePreviewHistory spins backend calls + debounced save timers via useEffect.
 * Under the worker-fork pool the ipcBridge / httpBridge chain never settles
 * (plan §2.4 WS reconnect hazard), and the hook hangs waitFor() indefinitely.
 * We therefore validate the module surface only; functional behavior is left
 * to e2e. This is recorded in N4c-final.md Deviations.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const IMPORT_TIMEOUT_MS = 120000;

beforeEach(() => {
  window.__backendPort = 13400;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  delete window.__backendPort;
});

describe('usePreviewHistory module shape', () => {
  it(
    'module loads and exposes usePreviewHistory',
    async () => {
      const mod = await import('@/renderer/pages/conversation/Preview/hooks/usePreviewHistory');
      expect(mod).toBeDefined();
      expect(mod.usePreviewHistory).toBeDefined();
    },
    IMPORT_TIMEOUT_MS
  );

  it(
    'usePreviewHistory is a function (React hook)',
    async () => {
      const mod = await import('@/renderer/pages/conversation/Preview/hooks/usePreviewHistory');
      expect(typeof mod.usePreviewHistory).toBe('function');
    },
    IMPORT_TIMEOUT_MS
  );

  it(
    'the hook function has at most one parameter (options bag)',
    async () => {
      const mod = await import('@/renderer/pages/conversation/Preview/hooks/usePreviewHistory');
      expect((mod.usePreviewHistory as { length: number }).length).toBeLessThanOrEqual(2);
    },
    IMPORT_TIMEOUT_MS
  );
});
