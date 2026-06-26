/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TConversationRuntimeSummary } from '@/common/config/storage';
import { describe, expect, it } from 'vitest';
import {
  backendRuntimeNeedsReconciliation,
  resolveReconcileTurnId,
  shouldPollRuntimeReconciliation,
} from '@/renderer/pages/conversation/runtime/conversationRuntimeReconcile';
import { createDefaultConversationRuntimeView } from '@/renderer/pages/conversation/runtime/conversationRuntimeViewStore';

const conversation_id = 'conversation-1';

const runtime = (overrides: Partial<TConversationRuntimeSummary>): TConversationRuntimeSummary => ({
  state: 'idle',
  can_send_message: true,
  has_task: false,
  task_status: 'finished',
  is_processing: false,
  pending_confirmations: 0,
  turn_id: null,
  ...overrides,
});

describe('conversationRuntimeReconcile', () => {
  it('polls only when hydrated and processing', () => {
    const idle = createDefaultConversationRuntimeView(conversation_id);
    expect(shouldPollRuntimeReconciliation(idle)).toBe(false);

    const processing = {
      ...idle,
      hydrated: true,
      isProcessing: true,
      state: 'running' as const,
    };
    expect(shouldPollRuntimeReconciliation(processing)).toBe(true);
  });

  it('detects backend idle while UI still processing', () => {
    const view = {
      ...createDefaultConversationRuntimeView(conversation_id),
      hydrated: true,
      isProcessing: true,
      activeTurnId: 'turn-1',
      state: 'running' as const,
    };

    expect(backendRuntimeNeedsReconciliation(view, runtime({ is_processing: true }))).toBe(false);
    expect(backendRuntimeNeedsReconciliation(view, runtime({ is_processing: false, turn_id: null }))).toBe(true);
    expect(backendRuntimeNeedsReconciliation(view, null)).toBe(false);
  });

  it('prefers the active UI turn id when reconciling', () => {
    const view = {
      ...createDefaultConversationRuntimeView(conversation_id),
      activeTurnId: 'turn-ui',
      isProcessing: true,
    };

    expect(resolveReconcileTurnId(view, runtime({ turn_id: 'turn-backend' }))).toBe('turn-ui');
    expect(resolveReconcileTurnId({ ...view, activeTurnId: null }, runtime({ turn_id: 'turn-backend' }))).toBe(
      'turn-backend'
    );
  });
});
