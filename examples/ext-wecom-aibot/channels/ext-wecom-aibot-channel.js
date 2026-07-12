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
  readCredentials,
  replyStreamForChat,
  uploadAndReplyFileForChat,
  redactCredentials,
  waitForAuthenticated,
  getWsClient,
} = require('./sdk-runtime');
const { shouldIgnoreGroupMessage, toUnifiedIncomingMessage } = require('./inbound');
const {
  resolveInboundAttachments,
  cleanupExpiredInboundFiles,
  inboundContentType,
  buildInboundText,
} = require('./inbound-media');
const {
  resolveFileFromMessage,
  planOutboundSend,
  auditOutboundFile,
} = require('./outbound-file');

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
    const { botId, secret } = readCredentials(this.config);
    if (!botId) throw new Error('ext-wecom-aibot: botId is required');
    if (!secret) throw new Error('ext-wecom-aibot: secret is required');
  }

  async start() {
    this.validateConfig();
    setActivePlugin(this);
    this.running = true;

    const onInboundFrame = async (frame) => {
      await this._handleIncomingFrame(frame);
    };

    connectClient(this.config, { onInboundFrame });
    await waitForAuthenticated();

    this._pollTimer = setInterval(() => {
      cleanupExpiredRecords();
      cleanupExpiredInboundFiles();
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

    setReplyContext(streamId, { frame, streamId, chatId });
    upsertStream(streamId, { chatId, visibleContent: '', finished: false });

    const botIdForCtx = String(this.config?.credentials?.botId || this.config?.credentials?.bot_id || '').trim();
    const client = getWsClient();
    const { attachments, failures } = await resolveInboundAttachments(client, body, {
      botId: botIdForCtx,
      chatId,
    });
    const text = buildInboundText(body, attachments, failures);
    const unified = toUnifiedIncomingMessage(body, botId, {
      attachments,
      text,
      contentType: inboundContentType(body?.msgtype, attachments),
    });
    unified.raw = {
      ...body,
      __frame: frame,
      __streamId: streamId,
    };

    this.metrics.received += 1;
    this.metrics.lastEventAt = Date.now();

    await this.messageHandler(unified);
  }

  _messageText(message) {
    if (typeof message === 'string') return String(message || '');
    return message?.content?.text || message?.text || '';
  }

  _messageType(message) {
    if (typeof message === 'string') return 'text';
    return String(message?.messageType || message?.type || 'text').toLowerCase();
  }

  /**
   * OUT.CTX.001: replyMedia before finish=true clears reply context.
   * OUT.DEGRADE.001: validation/upload failures become text fallback.
   */
  async sendMessage(chatId, message, options = {}) {
    if (!this.running) throw new Error('ext-wecom-aibot plugin is not running');
    const conversationId = options?.conversationId;
    const resolvedChatId =
      typeof chatId === 'string'
        ? chatId
        : options?.chatId || (conversationId ? this._chatIdFromConversation(conversationId) : '');
    const content = this._messageText(message);
    const messageType = this._messageType(message);
    const streamId = String(options?.streamId || '').trim();
    if (!streamId) {
      throw new Error('ext-wecom-aibot: sendMessage requires options.streamId (reply context)');
    }
    const finish = options?.finish !== false;
    const allowlistOptions = options?.outboundFile || {};

    upsertStream(streamId, {
      chatId: resolvedChatId,
      visibleContent: String(content || ''),
      finished: finish,
    });

    const fileMessage =
      messageType === 'file' ? resolveFileFromMessage(message, allowlistOptions) : null;
    const plan = planOutboundSend({
      messageType,
      text: content,
      finish,
      fileMessage,
      allowlistOptions,
    });

    for (const step of plan) {
      if (step.type === 'stream') {
        await replyStreamForChat(resolvedChatId, step.content || '', !!step.finish, streamId);
      } else if (step.type === 'media') {
        try {
          await uploadAndReplyFileForChat(resolvedChatId, step.file, streamId);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          auditOutboundFile('upload_failed', {
            basename: step.file?.fileName,
            ok: false,
            reason,
          });
          await replyStreamForChat(
            resolvedChatId,
            `[文件发送失败] ${step.file?.fileName || 'file'} — ${reason}`,
            false,
            streamId
          );
        }
      }
    }

    this.metrics.sent += 1;
    this.metrics.lastEventAt = Date.now();
    return { streamId, chatId: resolvedChatId, finished: finish, messageType };
  }

  async editMessage(chatId, messageId, message, options = {}) {
    const content =
      typeof message === 'string'
        ? message
        : message?.content?.text || message?.text || String(message || '');
    const finish = options?.finish === true;
    return this.sendMessage(chatId, typeof message === 'object' && message ? message : content, {
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
