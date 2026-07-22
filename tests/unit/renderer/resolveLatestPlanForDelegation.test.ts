/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessagePlan } from '@/common/chat/chatLib';
import { resolveLatestPlanForDelegation } from '@/renderer/pages/conversation/Messages/utils/resolveLatestPlanForDelegation';
import { describe, expect, it } from 'vitest';

const makePlan = (id: string, parentToolUseId: string, createdAt: number): IMessagePlan =>
  ({
    id,
    type: 'plan',
    created_at: createdAt,
    content: {
      session_id: 'session-1',
      parentToolUseId,
      entries: [{ content: `step-${id}`, status: 'pending' }],
    },
  }) as IMessagePlan;

describe('resolveLatestPlanForDelegation', () => {
  it('returns null when parentToolUseId is empty', () => {
    expect(resolveLatestPlanForDelegation([], '')).toBeNull();
  });

  it('returns latest plan for the parent tool call', () => {
    const messages = [
      makePlan('plan-1', 'parent-1', 100),
      makePlan('plan-2', 'parent-2', 200),
      makePlan('plan-3', 'parent-1', 300),
    ];

    const result = resolveLatestPlanForDelegation(messages, 'parent-1');
    expect(result?.id).toBe('plan-3');
  });

  it('ignores parent plans without parentToolUseId', () => {
    const parentPlan = {
      id: 'parent-plan',
      type: 'plan',
      created_at: 400,
      content: {
        session_id: 'session-1',
        entries: [{ content: 'parent step', status: 'pending' }],
      },
    } as IMessagePlan;

    expect(resolveLatestPlanForDelegation([parentPlan], 'parent-1')).toBeNull();
  });
});
