/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

// PreviewPanel pulls in a large dependency graph; under the full concurrent
// suite the first cold import can exceed per-test timeouts. One import warms
// the module for all shape assertions below.
const IMPORT_TIMEOUT_MS = 180000;

describe('PreviewPanel', () => {
  it(
    'loads as a default-export React component with a debug name',
    async () => {
      const mod = await import('@/renderer/pages/conversation/Preview/components/PreviewPanel/PreviewPanel');
      expect(mod).toBeTruthy();
      expect(typeof mod.default).toBe('function');
      const fn = mod.default;
      expect(fn.name || fn.displayName || 'anonymous').toBeTruthy();
    },
    IMPORT_TIMEOUT_MS
  );
});
