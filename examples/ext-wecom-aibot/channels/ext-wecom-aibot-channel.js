const { generateReqId } = require('@wecom/aibot-node-sdk');
const { PLUGIN_ID, resolveChatId } = require('./identity');
const {
  setActivePlugin,
  getConnectionSnapshot,
  setReplyContext,
  upsertStream,
  getLatestStreamByChatId,
  cleanupExpiredRecords,
  resetAll,
} = require('./state');
const {
  connectClient,
  disconnectClient,
  replyStreamForChat,
  redactCredentials,
} = require('./sdk-runtime');
const { shouldIgnoreGroupMessage, toUnifiedIncomingMessage } = require('./inbound');

class ExtWecomAibotChannel {
  constructor(config) {
    this.config = config || {};
    this.running = false;
    this.messageHandler = null;
    this._pollTimer = null;
    this.metrics = {
      received: 0,
      ignored: 0,
      sent: 0,
      lastEventAt: 0,
    };
  }

  validateConfig() {
    const creds = this.config?.credentials || {};
    const botId = String(creds.botId || creds.bot_id || '').trim();
    const secret = String(creds.secret || '').trim();
    if (!botId) throw new Error('ext-wecom-aibot: botId is required');
    if (!secret) throw new Error('ext-wecom-aibot: secret is required');
  }

  async start() {
    this.validateConfig();
    setActivePlugin(this);
    this.running = true;

    const onTextFrame = async (frame) => {
      await this._handleIncomingFrame(frame);
    };

    connectClient(this.config, { onTextFrame });

    this._pollTimer = setInterval(() => {
      cleanupExpiredRecords();
    }, 15_000);

    return { ok: true, pluginId: PLUGIN_ID, credentials: redactCredentials(this.config) };
  }

  async stop() {
    this.running = false;
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    disconnectClient(this.config);
    setActivePlugin(null);
    resetAll();
    this.messageHandler = null;
    return { ok: true };
  }

  isRunning() {
    return this.running;
  }

  onMessage(handler) {
    this.messageHandler = handler;
  }

  async _handleIncomingFrame(frame) {
    if (!this.messageHandler || !this.running) return;

    const body = frame?.body || {};
    const botId = String(this.config?.credentials?.botId || this.config?.credentials?.bot_id || '').trim();
    const strictGroupAt = this.config?.config?.strictGroupAt !== false;

    if (shouldIgnoreGroupMessage(body, { strictGroupAt })) {
      this.metrics.ignored += 1;
      return;
    }

    const chatId = resolveChatId(body);
    const streamId = generateReqId('stream');

    setReplyContext(chatId, { frame, streamId });
    upsertStream(streamId, { chatId, visibleContent: '', finished: false });

    const unified = toUnifiedIncomingMessage(body, botId);
    unified.raw = {
      ...body,
      __frame: frame,
      __streamId: streamId,
    };

    this.metrics.received += 1;
    this.metrics.lastEventAt = Date.now();

    await this.messageHandler(unified);
  }

  async sendMessage(chatId, message, options = {}) {
    if (!this.running) throw new Error('ext-wecom-aibot plugin is not running');
    const conversationId = options?.conversationId;
    const resolvedChatId =
      typeof chatId === 'string'
        ? chatId
        : options?.chatId || (conversationId ? this._chatIdFromConversation(conversationId) : '');
    const content =
      typeof message === 'string'
        ? message
        : message?.content?.text || message?.text || String(message || '');
    const streamId = options?.streamId || generateReqId('stream');
    const finish = options?.finish !== false;

    upsertStream(streamId, {
      chatId: resolvedChatId,
      visibleContent: String(content || ''),
      finished: finish,
    });

    await replyStreamForChat(resolvedChatId, String(content || ''), finish);
    this.metrics.sent += 1;
    this.metrics.lastEventAt = Date.now();
    return { streamId, chatId: resolvedChatId, finished: finish };
  }

  async editMessage(chatId, messageId, message, options = {}) {
    const content =
      typeof message === 'string'
        ? message
        : message?.content?.text || message?.text || String(message || '');
    const finish = options?.finish === true;
    return this.sendMessage(chatId, content, {
      ...options,
      streamId: messageId || options?.streamId,
      finish,
    });
  }

  _chatIdFromConversation(conversationId) {
    const parts = String(conversationId || '').split(':');
    if (parts.length >= 3 && parts[0] === PLUGIN_ID) {
      return parts.slice(2).join(':');
    }
    return String(conversationId || '');
  }

  getBotInfo() {
    const snap = getConnectionSnapshot();
    const creds = this.config?.credentials || {};
    return {
      pluginId: PLUGIN_ID,
      botId: creds.botId || creds.bot_id || '',
      connection: snap,
      mode: 'websocket-long-connection',
      metrics: { ...this.metrics },
    };
  }

  async getStreamStatus(chatId) {
    cleanupExpiredRecords();
    const stream = getLatestStreamByChatId(chatId);
    if (!stream) return { active: false };
    return {
      active: !stream.finished,
      streamId: stream.streamId,
      visibleContent: stream.visibleContent,
      finished: stream.finished,
    };
  }
}

module.exports = ExtWecomAibotChannel;
