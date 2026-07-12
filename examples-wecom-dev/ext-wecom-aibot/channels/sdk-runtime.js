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
const AUTH_TIMEOUT_MS = 45_000;
const AUTH_POLL_MS = 100;

function pickValue(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function readCredentials(config) {
  const creds = config?.credentials || {};
  const options = config?.config || {};
  return {
    botId: pickValue(creds.botId, creds.bot_id, creds.extra?.botId, creds.extra?.bot_id),
    secret: pickValue(creds.secret, creds.extra?.secret),
    wsUrl: pickValue(options.wsUrl, options.extra?.wsUrl, creds.wsUrl, creds.extra?.wsUrl) || DEFAULT_WS_URL,
  };
}

function redactCredentials(config) {
  const creds = readCredentials(config);
  return {
    botId: creds.botId ? `${creds.botId.slice(0, 4)}***` : '',
    hasSecret: !!creds.secret,
    wsUrl: creds.wsUrl,
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

function isAuthenticationFailureLog(args) {
  const msg = redactLogArgs(args)
    .map((part) => (typeof part === 'string' ? part : JSON.stringify(part)))
    .join(' ');
  return /Authentication failed|errcode=\d+|invalid bot_id or secret/i.test(msg);
}

function buildClientOptions(config) {
  const { botId, secret, wsUrl } = readCredentials(config);

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
        error: (...args) => {
          const redacted = redactLogArgs(args);
          console.error('[ext-wecom-aibot]', ...redacted);
          if (isAuthenticationFailureLog(args)) {
            const msg = redacted
              .map((part) => (typeof part === 'string' ? part : JSON.stringify(part)))
              .join(' ');
            setConnectionStatus('error', msg);
          }
        },
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

  const dispatchInbound = async (frame) => {
    if (!handlers.onInboundFrame) return;
    await handlers.onInboundFrame(frame);
  };

  client.on('message.text', dispatchInbound);
  client.on('message.file', dispatchInbound);
  client.on('message.image', dispatchInbound);
  client.on('message.mixed', dispatchInbound);
  client.on('message.voice', async (frame) => {
    if (!handlers.onInboundFrame) return;
    const content = frame?.body?.voice?.content;
    if (content) {
      await handlers.onInboundFrame({
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAuthenticated(options = {}) {
  const getSnapshot = options.getSnapshot || require('./state').getConnectionSnapshot;
  const intervalMs = options.intervalMs || AUTH_POLL_MS;
  const timeoutMs = options.timeoutMs || AUTH_TIMEOUT_MS;
  const wait = options.sleep || sleep;
  const startedAt = Date.now();

  loop:
  for (;;) {
    const snap = getSnapshot();
    switch (snap.status) {
      case 'authenticated':
        return snap;
      case 'error':
        throw new Error(snap.lastError || 'ext-wecom-aibot: authentication failed');
      case 'disconnected':
        if (Date.now() > startedAt + intervalMs) {
          throw new Error(snap.lastError || 'ext-wecom-aibot: disconnected before authentication');
        }
        break;
      default:
        break loop;
    }
  }

  while (Date.now() - startedAt < timeoutMs) {
    await wait(intervalMs);
    const snap = getSnapshot();
    if (snap.status === 'authenticated') return snap;
    if (snap.status === 'error') {
      throw new Error(snap.lastError || 'ext-wecom-aibot: authentication failed');
    }
    if (snap.status === 'disconnected') {
      throw new Error(snap.lastError || 'ext-wecom-aibot: disconnected before authentication');
    }
  }

  throw new Error('ext-wecom-aibot: authentication timed out');
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

async function replyStreamForChat(chatId, content, finish, streamId) {
  const client = getWsClient();
  const resolvedStreamId = String(streamId || '').trim();
  const ctx = resolvedStreamId
    ? require('./state').getReplyContext(resolvedStreamId)
    : null;
  if (!client || !ctx?.frame) {
    throw new Error(
      resolvedStreamId
        ? `ext-wecom-aibot: no active reply context for stream ${resolvedStreamId}`
        : 'ext-wecom-aibot: no active reply context (missing streamId)'
    );
  }
  const replyStreamId = ctx.streamId || resolvedStreamId || generateReqId('stream');
  await client.replyStream(ctx.frame, replyStreamId, content || '', !!finish);
  if (finish) {
    require('./state').clearReplyContext(resolvedStreamId || replyStreamId);
  }
  return replyStreamId;
}

/**
 * Upload a local file and reply via replyMedia while reply context is still live.
 * Does NOT clear reply context (WANd.WECOM.MEDIA.OUT.CTX.001).
 */
async function uploadAndReplyFileForChat(chatId, validatedFile, streamId) {
  const fs = require('fs');
  const client = getWsClient();
  const resolvedStreamId = String(streamId || '').trim();
  const ctx = resolvedStreamId
    ? require('./state').getReplyContext(resolvedStreamId)
    : null;
  if (!client || !ctx?.frame) {
    throw new Error(
      resolvedStreamId
        ? `ext-wecom-aibot: no active reply context for stream ${resolvedStreamId}`
        : 'ext-wecom-aibot: no active reply context (missing streamId)'
    );
  }
  if (!validatedFile?.ok || !validatedFile.absolutePath) {
    throw new Error('ext-wecom-aibot: invalid outbound file');
  }

  const buffer = fs.readFileSync(validatedFile.absolutePath);
  const upload = await client.uploadMedia(buffer, {
    type: 'file',
    filename: validatedFile.fileName,
  });
  const mediaId = upload?.media_id || upload?.mediaId;
  if (!mediaId) {
    throw new Error('ext-wecom-aibot: uploadMedia returned no media_id');
  }

  await client.replyMedia(ctx.frame, 'file', mediaId);
  return { mediaId, fileName: validatedFile.fileName };
}

module.exports = {
  DEFAULT_WS_URL,
  readCredentials,
  redactCredentials,
  redactLogArgs,
  isAuthenticationFailureLog,
  buildClientOptions,
  connectClient,
  disconnectClient,
  attachClientHandlers,
  waitForAuthenticated,
  replyStreamForChat,
  uploadAndReplyFileForChat,
  getWsClient,
  generateReqId,
};
