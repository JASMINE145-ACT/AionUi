/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessagePlan, TMessage } from '@/common/chat/chatLib';

/**
 * Latest TodoWrite plan for a delegated Agent() parent tool call.
 * Reads from the message list — plan rows are not tool-call messages.
 */
export function resolveLatestPlanForDelegation(
  messages: TMessage[],
  parentToolUseId: string,
): IMessagePlan | null {
  if (!parentToolUseId) {
    return null;
  }

  let latest: IMessagePlan | null = null;
  let latestCreatedAt = -1;

  for (const message of messages) {
    if (message.type !== 'plan') {
      continue;
    }
    const plan = message as IMessagePlan;
    if (plan.content?.parentToolUseId !== parentToolUseId) {
      continue;
    }
    const createdAt = plan.created_at ?? 0;
    if (createdAt >= latestCreatedAt) {
      latest = plan;
      latestCreatedAt = createdAt;
    }
  }

  return latest;
}
