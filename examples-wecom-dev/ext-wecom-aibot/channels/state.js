const STREAM_IDLE_MS = 30_000;
const STREAM_TTL_MS = 5 * 60_000;

/** @type {'disconnected'|'connecting'|'authenticated'|'reconnecting'|'error'} */
let connectionStatus = 'disconnected';
let lastError = null;
let lastConnectedAt = 0;
let activeBotId = null;
let activePlugin = null;

/** @type {import('@wecom/aibot-node-sdk').WSClient | null} */
let wsClient = null;

const streamStore = new Map();
/** streamId -> { frame, streamId } for SDK replyStream */
const replyContextByChat = new Map();

function now() {
  return Date.now();
}

function setConnectionStatus(status, error) {
  connectionStatus = status;
  if (error) {
    lastError = error instanceof Error ? error.message : String(error);
  } else if (status === 'authenticated') {
    lastError = null;
    lastConnectedAt = now();
  }
}

function getConnectionSnapshot() {
  return {
    status: connectionStatus,
    lastError,
    lastConnectedAt,
    activeBotId,
    isConnected: connectionStatus === 'authenticated',
  };
}

function tryAcquireBotLock(botId) {
  const normalized = String(botId || '').trim();
  if (!normalized) return { ok: false, reason: 'missing-bot-id' };
  if (activeBotId && activeBotId !== normalized) {
    return { ok: false, reason: 'bot-id-already-active', activeBotId };
  }
  activeBotId = normalized;
  return { ok: true };
}

function releaseBotLock(botId) {
  const normalized = String(botId || '').trim();
  if (!normalized || activeBotId === normalized) {
    activeBotId = null;
  }
}

function setWsClient(client) {
  wsClient = client || null;
}

function getWsClient() {
  return wsClient;
}

function setActivePlugin(plugin) {
  activePlugin = plugin || null;
}

function getActivePlugin() {
  return activePlugin;
}

function setReplyContext(chatId, context) {
  if (!chatId) return;
  replyContextByChat.set(String(chatId), context);
}

function getReplyContext(chatId) {
  return replyContextByChat.get(String(chatId)) || null;
}

function clearReplyContext(chatId) {
  if (chatId) replyContextByChat.delete(String(chatId));
}

function upsertStream(streamId, payload) {
  const existing = streamStore.get(streamId) || {
    streamId,
    chatId: payload.chatId || '',
    visibleContent: '',
    finished: false,
    updatedAt: now(),
  };
  if (typeof payload.visibleContent === 'string') existing.visibleContent = payload.visibleContent;
  if (payload.finished === true) existing.finished = true;
  if (payload.chatId) existing.chatId = payload.chatId;
  existing.updatedAt = now();
  streamStore.set(streamId, existing);
  return existing;
}

function getLatestStreamByChatId(chatId) {
  if (!chatId) return null;
  let latest = null;
  for (const stream of streamStore.values()) {
    if (stream.chatId !== chatId) continue;
    if (!latest || stream.updatedAt > latest.updatedAt) latest = stream;
  }
  return latest;
}

function cleanupExpiredRecords() {
  const current = now();
  for (const [streamId, stream] of streamStore.entries()) {
    const age = current - stream.updatedAt;
    if (stream.finished && age > STREAM_IDLE_MS) {
      streamStore.delete(streamId);
      continue;
    }
    if (!stream.finished && age > STREAM_TTL_MS) {
      streamStore.delete(streamId);
    }
  }
}

function resetAll() {
  connectionStatus = 'disconnected';
  lastError = null;
  lastConnectedAt = 0;
  activeBotId = null;
  activePlugin = null;
  wsClient = null;
  streamStore.clear();
  replyContextByChat.clear();
}

module.exports = {
  setConnectionStatus,
  getConnectionSnapshot,
  tryAcquireBotLock,
  releaseBotLock,
  setWsClient,
  getWsClient,
  setActivePlugin,
  getActivePlugin,
  setReplyContext,
  getReplyContext,
  clearReplyContext,
  upsertStream,
  getLatestStreamByChatId,
  cleanupExpiredRecords,
  resetAll,
};
