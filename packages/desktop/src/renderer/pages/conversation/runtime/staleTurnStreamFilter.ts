/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IResponseMessage } from '@/common/adapter/ipcBridge';
import { getPostIdleWakeWindowTurnId } from '@/renderer/pages/conversation/runtime/postIdleWakeWindow';

const TURN_SCOPED_STREAM_TYPES = new Set([
  'text',
  'content',
  'thinking',
  'tool_call',
  'tool_group',
  'acp_tool_call',
  'acp_permission',
  'permission',
  'plan',
]);

export function isTurnScopedStreamType(type: string): boolean {
  return TURN_SCOPED_STREAM_TYPES.has(type);
}

/**
 * Drop turn-scoped WS events during post-idle wake window (warmup replay / pre-accept).
 */
export function shouldDropStaleTurnStreamMessage(
  conversation_id: string,
  message: Pick<IResponseMessage, 'type' | 'turn_id'>
): boolean {
  const wakeTurnId = getPostIdleWakeWindowTurnId(conversation_id);
  if (wakeTurnId === undefined) {
    return false;
  }

  if (!isTurnScopedStreamType(message.type)) {
    return false;
  }

  // Pre-accept: drop all turn-scoped replay during warmup until send accepts turn_id.
  if (wakeTurnId === null) {
    return true;
  }

  // Post-accept: drop explicit stale turn_id; allow missing turn_id for live stream chunks.
  if (!message.turn_id) {
    return false;
  }

  return message.turn_id !== wakeTurnId;
}

/**
 * When the conversation is idle, assistant stream events without turn_id are almost
 * always session-history replay leaking into the live list.
 */
export function shouldDropIdleReplayWithoutTurnId(
  message: Pick<IResponseMessage, 'type' | 'turn_id'>,
  idle: boolean
): boolean {
  if (!idle) {
    return false;
  }
  if (!isTurnScopedStreamType(message.type)) {
    return false;
  }
  return !message.turn_id;
}
