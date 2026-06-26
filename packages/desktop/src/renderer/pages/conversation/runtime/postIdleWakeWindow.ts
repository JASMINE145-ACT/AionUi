/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

type WakeWindow = {
  activeTurnId: string | null;
  expiresAt: number;
};

const WAKE_WINDOW_AFTER_ACCEPT_MS = 10_000;
const wakeWindows = new Map<string, WakeWindow>();

const nowMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const beginPostIdleWakeWindow = (conversation_id: string): void => {
  if (!conversation_id) return;
  wakeWindows.set(conversation_id, {
    activeTurnId: null,
    expiresAt: Number.POSITIVE_INFINITY,
  });
};

export const acceptPostIdleWakeTurn = (conversation_id: string, turn_id: string): void => {
  if (!conversation_id || !wakeWindows.has(conversation_id)) return;
  wakeWindows.set(conversation_id, {
    activeTurnId: turn_id,
    expiresAt: nowMs() + WAKE_WINDOW_AFTER_ACCEPT_MS,
  });
};

export const clearPostIdleWakeWindow = (conversation_id: string): void => {
  if (!conversation_id) return;
  wakeWindows.delete(conversation_id);
};

export const getPostIdleWakeWindowTurnId = (conversation_id: string): string | null | undefined => {
  const window = wakeWindows.get(conversation_id);
  if (!window) return undefined;
  if (window.expiresAt <= nowMs()) {
    wakeWindows.delete(conversation_id);
    return undefined;
  }
  return window.activeTurnId;
};

export const resetPostIdleWakeWindowsForTest = (): void => {
  wakeWindows.clear();
};
