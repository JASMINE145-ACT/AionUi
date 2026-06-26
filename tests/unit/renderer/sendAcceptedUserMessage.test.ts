/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { buildSendAcceptedUserTextMessage } from '@/renderer/pages/conversation/utils/sendAcceptedUserMessage';

describe('buildSendAcceptedUserTextMessage', () => {
  it('builds a right-side user text message with server ids', () => {
    const message = buildSendAcceptedUserTextMessage({
      conversation_id: 'conv-1',
      msg_id: 'msg-user',
      turn_id: 'turn-1',
      content: '你好',
      created_at: 1000,
    });

    expect(message).toEqual(
      expect.objectContaining({
        id: 'msg-user',
        msg_id: 'msg-user',
        turn_id: 'turn-1',
        conversation_id: 'conv-1',
        type: 'text',
        position: 'right',
        status: 'finish',
        created_at: 1000,
        content: { content: '你好' },
      })
    );
  });
});
