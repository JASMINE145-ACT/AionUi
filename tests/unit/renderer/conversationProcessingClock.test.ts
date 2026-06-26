/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearConversationProcessingStartedAt,
  ensureConversationProcessingStartedAt,
  getConversationProcessingStartedAt,
  resetConversationProcessingClockForTest,
} from '@/renderer/pages/conversation/runtime/conversationProcessingClock';

describe('conversationProcessingClock', () => {
  beforeEach(() => {
    resetConversationProcessingClockForTest();
  });

  it('preserves the first startedAt for a conversation', () => {
    const first = ensureConversationProcessingStartedAt('conv-1', 1_000);
    const second = ensureConversationProcessingStartedAt('conv-1', 9_000);
    expect(first).toBe(1_000);
    expect(second).toBe(1_000);
    expect(getConversationProcessingStartedAt('conv-1')).toBe(1_000);
  });

  it('clears startedAt independently per conversation', () => {
    ensureConversationProcessingStartedAt('conv-a', 100);
    ensureConversationProcessingStartedAt('conv-b', 200);
    clearConversationProcessingStartedAt('conv-a');
    expect(getConversationProcessingStartedAt('conv-a')).toBeUndefined();
    expect(getConversationProcessingStartedAt('conv-b')).toBe(200);
  });
});
