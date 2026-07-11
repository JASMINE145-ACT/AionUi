import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const inbound = require('../../../examples/ext-wecom-aibot/channels/inbound') as {
  extractInboundText: (payload: Record<string, unknown>) => string;
  shouldIgnoreGroupMessage: (
    body: Record<string, unknown>,
    options?: { strictGroupAt?: boolean }
  ) => boolean;
  toUnifiedIncomingMessage: (payload: Record<string, unknown>, botId: string) => {
    platform: string;
    conversationId: string;
    chatId: string;
    user: { id: string; platformUserId: string };
    content: { text: string };
  };
};

describe('ext-wecom-aibot inbound', () => {
  it('extracts text and voice content', () => {
    expect(inbound.extractInboundText({ msgtype: 'text', text: { content: 'hello' } })).toBe('hello');
    expect(inbound.extractInboundText({ msgtype: 'voice', voice: { content: 'voice-text' } })).toBe('voice-text');
  });

  it('ignores empty group noise by default', () => {
    expect(
      inbound.shouldIgnoreGroupMessage({
        chattype: 'group',
        chatid: 'g1',
        msgtype: 'text',
        text: { content: '   ' },
      })
    ).toBe(true);
  });

  it('accepts group messages with quote reply', () => {
    expect(
      inbound.shouldIgnoreGroupMessage({
        chattype: 'group',
        chatid: 'g1',
        quote: { msgtype: 'text', text: { content: 'prior' } },
        text: { content: 'follow up' },
      })
    ).toBe(false);
  });

  it('strictGroupAt requires @ in text', () => {
    expect(
      inbound.shouldIgnoreGroupMessage(
        { chattype: 'group', chatid: 'g1', text: { content: 'no mention' } },
        { strictGroupAt: true }
      )
    ).toBe(true);
    expect(
      inbound.shouldIgnoreGroupMessage(
        { chattype: 'group', chatid: 'g1', text: { content: '@bot hi' } },
        { strictGroupAt: true }
      )
    ).toBe(false);
  });

  it('strictGroupAt accepts structured bot mentions', () => {
    expect(
      inbound.shouldIgnoreGroupMessage(
        {
          chattype: 'group',
          chatid: 'g1',
          text: { content: 'hi bot' },
          mentioned_list: ['aibot-1'],
          aibotid: 'aibot-1',
        },
        { strictGroupAt: true }
      )
    ).toBe(false);
  });

  it('strictGroupAt ignores unrelated @ mentions', () => {
    expect(
      inbound.shouldIgnoreGroupMessage(
        {
          chattype: 'group',
          chatid: 'g1',
          text: { content: '@alice hi' },
          mentioned_list: ['alice'],
          aibotid: 'aibot-1',
        },
        { strictGroupAt: true }
      )
    ).toBe(true);
  });

  it('builds unified incoming message with namespaced ids', () => {
    const unified = inbound.toUnifiedIncomingMessage(
      {
        msgid: 'm1',
        chattype: 'single',
        from: { userid: 'alice' },
        msgtype: 'text',
        text: { content: 'hi' },
      },
      'bot-9'
    );
    expect(unified.platform).toBe('ext-wecom-aibot');
    expect(unified.conversationId).toBe('ext-wecom-aibot:bot-9:dm:alice');
    expect(unified.user.id).toBe('ext-wecom-aibot:bot-9:alice');
    expect(unified.content.text).toBe('hi');
  });
});
