/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Preload-equivalent bootstrap for WebUI browser mode: inject org server URL
 * and SSO mode before React mounts (Electron preload sets these via IPC).
 */

import { isWebUiBrowserMode } from '@/common/adapter/httpBridge';

declare global {
  interface Window {
    __orgServerUrl?: string;
    __ssoMode?: string;
  }
}

type WebUiRuntimeConfigResponse = {
  orgServerUrl?: string;
  ssoMode?: string;
};

export async function hydrateWebUiRuntimeConfig(): Promise<void> {
  if (!isWebUiBrowserMode()) {
    return;
  }

  try {
    const response = await fetch('/api/webui/runtime-config', { credentials: 'include' });
    if (!response.ok) {
      console.warn('[WebUI] runtime-config fetch failed:', response.status);
      return;
    }

    const data = (await response.json()) as WebUiRuntimeConfigResponse;
    if (typeof data.orgServerUrl === 'string' && data.orgServerUrl.trim().length > 0) {
      window.__orgServerUrl = data.orgServerUrl.trim().replace(/\/$/, '');
    }
    if (typeof data.ssoMode === 'string' && data.ssoMode.trim().length > 0) {
      window.__ssoMode = data.ssoMode.trim();
    }
  } catch (error) {
    console.error('[WebUI] Failed to hydrate runtime config:', error);
  }
}
