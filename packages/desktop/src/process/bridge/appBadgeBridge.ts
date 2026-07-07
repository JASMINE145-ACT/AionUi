/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Windows taskbar badge (Cursor-style unread count on app icon).
 */

import { ipcBridge } from '@/common';
import { app } from 'electron';

export function setAppBadgeCount(count: number): void {
  if (process.platform !== 'win32') {
    return;
  }

  try {
    app.setBadgeCount(Math.max(0, count));
  } catch (error) {
    console.error('[AppBadge] Failed to set badge count:', error);
  }
}

export function initAppBadgeBridge(): void {
  ipcBridge.appBadge.setCount.provider(async ({ count }) => {
    setAppBadgeCount(count);
  });
}
