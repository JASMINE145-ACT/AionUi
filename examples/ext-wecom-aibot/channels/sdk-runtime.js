const AiBot = require('@wecom/aibot-node-sdk');
const { generateReqId } = require('@wecom/aibot-node-sdk');

const {
  setConnectionStatus,
  setWsClient,
  getWsClient,
  tryAcquireBotLock,
  releaseBotLock,
  setReplyContext,
} = require('./state');

const DEFAULT_WS_URL = 'wss://openws.work.weixin.qq.com';

function redactCredentials(config) {
  const creds = config?.credentials || {};
  const botId = String(creds.botId || creds.bot_id || '').trim();
  return {
    botId: botId ? `${botId.slice(0, 4)}***` : '',
    hasSecret: !!creds.secret,
    wsUrl: config?.config?.wsUrl || DEFAULT_WS_URL,
  };
}

function redactLogArgs(args) {
  return args.map((arg) => {
    if (typeof arg === 'string') {
      return arg.replace(/secret[=:]\s*\S+/gi, 'secret=***').replace(/botId[=:]\s*\S+/gi, 'botId=***');
    }
    if (arg && typeof arg === 'object') {
      try {
        const json = JSON.stringify(arg);
        if (/secret|botId/i.test(json)) {
          return redactCredentials({ credentials: arg.credentials || arg, config: arg.config });
        }
      } catch {
        return '[object]';
      }
    }
    return arg;
  });
}

function buildClientOptions(config) {
  const creds = config?.credentials || {};
  const botId = String(creds.botId || creds.bot_id || '').trim();
  const secret = String(creds.secret || '').trim();
  const wsUrl = String(config?.config?.wsUrl || creds.wsUrl || '').trim() || DEFAULT_WS_URL;

  if (!botId) throw new Error('ext-wecom-aibot: botId is required');
  if (!secret) throw new Error('ext-wecom-aibot: secret is required');

  const lock = tryAcquireBotLock(botId);
  if (!lock.ok) {
    throw new Error(`ext-wecom-aibot: Bot ID already active (${lock.activeBotId || 'unknown'})`);
  }

  return {
    botId,
    secret,
    wsUrl,
    options: {
      botId,
      secret,
      wsUrl,
      logger: {
        debug: () => {},
        info: (...args) => console.info('[ext-wecom-aibot]', ...redactLogArgs(args)),
        warn: (...args) => console.warn('[ext-wecom-aibot]', ...redactLogArgs(args)),
        error: (...args) => console.error('[ext-wecom-aibot]', ...redactLogArgs(args)),
      },
    },
  };
}

function attachClientHandlers(client, handlers) {
  client.on('connected', () => {
    setConnectionStatus('connecting');
  });

  client.on('authenticated', () => {
    setConnectionStatus('authenticated');
  });

  client.on('reconnecting', () => {
    setConnectionStatus('reconnecting');
  });

  client.on('disconnected', (reason) => {
    setConnectionStatus('disconnected', reason ? new Error(String(reason)) : null);
  });

  client.on('error', (error) => {
    setConnectionStatus('error', error);
    const snap = require('./state').getConnectionSnapshot();
    if (snap.activeBotId) {
      releaseBotLock(snap.activeBotId);
    }
  });

  const dispatchText = async (frame) => {
    if (!handlers.onTextFrame) return;
    await handlers.onTextFrame(frame);
  };

  client.on('message.text', dispatchText);
  client.on('message.voice', async (frame) => {
    if (!handlers.onTextFrame) return;
    const content = frame?.body?.voice?.content;
    if (content) {
      await handlers.onTextFrame({
        ...frame,
        body: {
          ...frame.body,
          msgtype: 'text',
          text: { content },
        },
      });
    }
  });
}

function connectClient(config, handlers) {
  const built = buildClientOptions(config);
  const existing = getWsClient();
  if (existing?.isConnected) {
    const snap = require('./state').getConnectionSnapshot();
    if (snap.activeBotId && snap.activeBotId === built.botId) {
      return existing;
    }
    throw new Error(
      `ext-wecom-aibot: Bot ID already active (${snap.activeBotId || 'unknown'}); stop before switching`
    );
  }

  setConnectionStatus('connecting');

  const client = new AiBot.WSClient(built.options);
  attachClientHandlers(client, handlers);
  setWsClient(client);
  client.connect();
  return client;
}

function disconnectClient(config) {
  const client = getWsClient();
  if (client) {
    try {
      client.disconnect();
    } catch {
      // ignore teardown errors
    }
  }
  setWsClient(null);
  const botId = String(config?.credentials?.botId || config?.credentials?.bot_id || '').trim();
  releaseBotLock(botId);
  setConnectionStatus('disconnected');
}

async function replyStreamForChat(chatId, content, finish) {
  const client = getWsClient();
  const ctx = require('./state').getReplyContext(chatId);
  if (!client || !ctx?.frame) {
    throw new Error('ext-wecom-aibot: no active reply context for chat');
  }
  const streamId = ctx.streamId || generateReqId('stream');
  await client.replyStream(ctx.frame, streamId, content || '', !!finish);
  if (finish) {
    require('./state').clearReplyContext(chatId);
  }
  return streamId;
}

module.exports = {
  DEFAULT_WS_URL,
  redactCredentials,
  redactLogArgs,
  buildClientOptions,
  connectClient,
  disconnectClient,
  attachClientHandlers,
  replyStreamForChat,
  generateReqId,
};
