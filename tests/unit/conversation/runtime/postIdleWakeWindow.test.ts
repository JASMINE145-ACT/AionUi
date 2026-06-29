/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  acceptPostIdleWakeTurn,
  beginPostIdleWakeWindow,
  clearPostIdleWakeWindow,
  getPostIdleWakeWindowTurnId,
  resetPostIdleWakeWindowsForTest,
  scheduleWarmupReplayGuardEnd,
} from '@/renderer/pages/conversation/runtime/postIdleWakeWindow';

const conversation_id = 'conversation-1';

describe('postIdleWakeWindow', () => {
  beforeEach(() => {
    resetPostIdleWakeWindowsForTest();
  });

  it('starts as inactive', () => {
    expect(getPostIdleWakeWindowTurnId(conversation_id)).toBeUndefined();
  });

  it('marks the pre-accept wake window with a null turn id', () => {
    beginPostIdleWakeWindow(conversation_id);

    expect(getPostIdleWakeWindowTurnId(conversation_id)).toBeNull();
  });

  it('records the accepted turn for the wake window', () => {
    beginPostIdleWakeWindow(conversation_id);
    acceptPostIdleWakeTurn(conversation_id, 'turn-1');

    expect(getPostIdleWakeWindowTurnId(conversation_id)).toBe('turn-1');
  });

  it('clears a wake window', () => {
    beginPostIdleWakeWindow(conversation_id);
    acceptPostIdleWakeTurn(conversation_id, 'turn-1');
    clearPostIdleWakeWindow(conversation_id);

    expect(getPostIdleWakeWindowTurnId(conversation_id)).toBeUndefined();
  });

  it('scheduleWarmupReplayGuardEnd expires pre-accept window', async () => {
    beginPostIdleWakeWindow(conversation_id);
    scheduleWarmupReplayGuardEnd(conversation_id, 20);
    expect(getPostIdleWakeWindowTurnId(conversation_id)).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(getPostIdleWakeWindowTurnId(conversation_id)).toBeUndefined();
  });
});
