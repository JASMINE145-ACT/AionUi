import { describe, expect, it, beforeEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const identity = require('../../../examples/ext-wecom-aibot/channels/identity') as {
  PLUGIN_ID: string;
  buildConversationId: (botId: string, chatId: string) => string;
  buildUserId: (botId: string, wecomUserId: string) => string;
  resolveChatId: (body: Record<string, unknown>) => string;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const state = require('../../../examples/ext-wecom-aibot/channels/state') as {
  tryAcquireBotLock: (botId: string) => { ok: boolean; reason?: string; activeBotId?: string };
  releaseBotLock: (botId: string) => void;
  resetAll: () => void;
  setConnectionStatus: (status: string, error?: unknown) => void;
  getConnectionSnapshot: () => { status: string; activeBotId: string | null };
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sdkRuntime = require('../../../examples/ext-wecom-aibot/channels/sdk-runtime') as {
  redactCredentials: (config: Record<string, unknown>) => {
    botId: string;
    hasSecret: boolean;
    wsUrl: string;
  };
  readCredentials: (config: Record<string, unknown>) => {
    botId: string;
    secret: string;
    wsUrl: string;
  };
  waitForAuthenticated: (
    options?: {
      getSnapshot?: () => { status: string; lastError?: string | null };
      intervalMs?: number;
      timeoutMs?: number;
      sleep?: (ms: number) => Promise<void>;
    }
  ) => Promise<{ status: string }>;
};

describe('ext-wecom-aibot identity', () => {
  it('namespaces conversation and user ids', () => {
    expect(identity.PLUGIN_ID).toBe('ext-wecom-aibot');
    expect(identity.buildConversationId('bot-1', 'chat-9')).toBe('ext-wecom-aibot:bot-1:chat-9');
    expect(identity.buildUserId('bot-1', 'user-x')).toBe('ext-wecom-aibot:bot-1:user-x');
  });

  it('resolves DM chat id from from.userid', () => {
    const chatId = identity.resolveChatId({
      chattype: 'single',
      from: { userid: 'alice' },
    });
    expect(chatId).toBe('dm:alice');
  });

  it('resolves group chat id from chatid', () => {
    const chatId = identity.resolveChatId({
      chattype: 'group',
      chatid: 'wr123group',
      from: { userid: 'bob' },
    });
    expect(chatId).toBe('wr123group');
  });
});

describe('ext-wecom-aibot state + sdk-runtime helpers', () => {
  beforeEach(() => {
    state.resetAll();
  });

  it('redacts credentials for logging', () => {
    const redacted = sdkRuntime.redactCredentials({
      credentials: { botId: 'wwABCDEF123', secret: 'super-secret' },
      config: { wsUrl: 'wss://custom.example' },
    });
    expect(redacted.botId).toBe('wwAB***');
    expect(redacted.hasSecret).toBe(true);
    expect(redacted.wsUrl).toBe('wss://custom.example');
  });

  it('reads credentials from flattened extension config', () => {
    const creds = sdkRuntime.readCredentials({
      credentials: { botId: 'wwBOT123', secret: 'super-secret' },
      config: { wsUrl: 'wss://custom.example' },
    });
    expect(creds.botId).toBe('wwBOT123');
    expect(creds.secret).toBe('super-secret');
    expect(creds.wsUrl).toBe('wss://custom.example');
  });

  it('reads credentials from legacy nested extra config', () => {
    const creds = sdkRuntime.readCredentials({
      credentials: { extra: { botId: 'wwBOT456', secret: 'nested-secret' } },
      config: { extra: { wsUrl: 'wss://extra.example' } },
    });
    expect(creds.botId).toBe('wwBOT456');
    expect(creds.secret).toBe('nested-secret');
    expect(creds.wsUrl).toBe('wss://extra.example');
  });

  it('enforces single active Bot ID lock', () => {
    expect(state.tryAcquireBotLock('bot-a').ok).toBe(true);
    const second = state.tryAcquireBotLock('bot-b');
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('bot-id-already-active');
    state.releaseBotLock('bot-a');
    expect(state.tryAcquireBotLock('bot-b').ok).toBe(true);
  });

  it('tracks connection status transitions', () => {
    state.setConnectionStatus('connecting');
    state.setConnectionStatus('authenticated');
    expect(state.getConnectionSnapshot().status).toBe('authenticated');
  });

  it('waits until the SDK connection is authenticated', async () => {
    const snapshots = [{ status: 'connecting' }, { status: 'authenticated' }];
    const result = await sdkRuntime.waitForAuthenticated({
      getSnapshot: () => snapshots.shift() || { status: 'authenticated' },
      intervalMs: 1,
      timeoutMs: 10,
      sleep: async () => {},
    });
    expect(result.status).toBe('authenticated');
  });

  it('fails fast when the SDK connection enters error state', async () => {
    await expect(
      sdkRuntime.waitForAuthenticated({
        getSnapshot: () => ({ status: 'error', lastError: 'bad secret' }),
        intervalMs: 1,
        timeoutMs: 10,
        sleep: async () => {},
      })
    ).rejects.toThrow('bad secret');
  });
});
