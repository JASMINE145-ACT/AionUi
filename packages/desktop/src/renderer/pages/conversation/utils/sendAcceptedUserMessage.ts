/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TMessage } from '@/common/chat/chatLib';

/** Optimistic user bubble using the server-assigned msg_id from sendMessage. */
export function buildSendAcceptedUserTextMessage(params: {
  conversation_id: string;
  msg_id: string;
  turn_id: string;
  content: string;
  created_at?: number;
}): TMessage {
  return {
    id: params.msg_id,
    msg_id: params.msg_id,
    turn_id: params.turn_id,
    conversation_id: params.conversation_id,
    type: 'text',
    position: 'right',
    status: 'finish',
    created_at: params.created_at ?? Date.now(),
    content: {
      content: params.content,
    },
  };
}
