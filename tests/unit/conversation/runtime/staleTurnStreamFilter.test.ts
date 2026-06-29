/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  acceptPostIdleWakeTurn,
  beginPostIdleWakeWindow,
  clearPostIdleWakeWindow,
  resetPostIdleWakeWindowsForTest,
} from '@/renderer/pages/conversation/runtime/postIdleWakeWindow';
import {
  shouldDropIdleReplayWithoutTurnId,
  shouldDropStaleTurnStreamMessage,
} from '@/renderer/pages/conversation/runtime/staleTurnStreamFilter';

const conversation_id = 'conv-filter';

describe('staleTurnStreamFilter', () => {
  beforeEach(() => {
    resetPostIdleWakeWindowsForTest();
  });

  it('drops turn-scoped messages during pre-accept wake window', () => {
    beginPostIdleWakeWindow(conversation_id);
    expect(
      shouldDropStaleTurnStreamMessage(conversation_id, { type: 'text', turn_id: 'old-turn' })
    ).toBe(true);
    expect(
      shouldDropStaleTurnStreamMessage(conversation_id, { type: 'finish', turn_id: 'old-turn' })
    ).toBe(false);
  });

  it('accepts only the active turn after acceptPostIdleWakeTurn', () => {
    beginPostIdleWakeWindow(conversation_id);
    acceptPostIdleWakeTurn(conversation_id, 'turn-2');
    expect(
      shouldDropStaleTurnStreamMessage(conversation_id, { type: 'text', turn_id: 'turn-1' })
    ).toBe(true);
    expect(
      shouldDropStaleTurnStreamMessage(conversation_id, { type: 'text', turn_id: 'turn-2' })
    ).toBe(false);
    expect(
      shouldDropStaleTurnStreamMessage(conversation_id, { type: 'text', turn_id: undefined })
    ).toBe(false);
  });

  it('drops idle replay without turn_id', () => {
    clearPostIdleWakeWindow(conversation_id);
    expect(shouldDropIdleReplayWithoutTurnId({ type: 'text', turn_id: undefined }, true)).toBe(true);
    expect(shouldDropIdleReplayWithoutTurnId({ type: 'text', turn_id: 'turn-1' }, true)).toBe(false);
    expect(shouldDropIdleReplayWithoutTurnId({ type: 'text', turn_id: undefined }, false)).toBe(false);
  });
});
