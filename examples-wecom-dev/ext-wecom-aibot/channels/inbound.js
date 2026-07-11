const { PLUGIN_ID, buildConversationId, buildUserId, resolveChatId } = require('./identity');

function extractInboundText(payload) {
  const msgType = payload?.msgtype;
  if (!msgType || msgType === 'text') {
    const direct = payload?.text?.content;
    if (typeof direct === 'string') return direct;
  }
  if (msgType === 'text') {
    return payload?.text?.content || '';
  }
  if (msgType === 'voice') {
    return payload?.voice?.content || '';
  }
  if (msgType === 'mixed') {
    const items = Array.isArray(payload?.mixed?.msg_item) ? payload.mixed.msg_item : [];
    return items
      .map((item) => {
        if (item?.msgtype === 'text') return item?.text?.content || '';
        if (item?.msgtype === 'image') return item?.image?.url ? `[图片] ${item.image.url}` : '';
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (msgType === 'image') {
    return payload?.image?.url ? `[图片] ${payload.image.url}` : '[图片]';
  }
  if (msgType === 'file') {
    return payload?.file?.name ? `[文件] ${payload.file.name}` : '[文件]';
  }
  if (msgType === 'video') {
    return payload?.video?.url ? `[视频] ${payload.video.url}` : '[视频]';
  }
  return '';
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return value.split(',').map((item) => item.trim());
  return [];
}

function hasStructuredBotMention(body) {
  const botId = String(body?.aibotid || body?.botid || body?.bot_id || '').trim();
  const mentionLists = [
    ...toArray(body?.mentioned_list),
    ...toArray(body?.mention_list),
    ...toArray(body?.text?.mentioned_list),
    ...toArray(body?.text?.mention_list),
  ].map((item) => String(item || '').trim());

  if (botId && mentionLists.includes(botId)) return true;
  if (mentionLists.includes('@all')) return true;
  return body?.at_bot === true || body?.is_at_bot === true || body?.mentioned_bot === true;
}

/**
 * Group messages without @bot should be ignored (PRD v1).
 * WeCom AI Bot long-connection typically only delivers @bot group messages at the platform layer.
 * This helper adds belt-and-suspenders filtering when strictGroupAt is enabled.
 */
function shouldIgnoreGroupMessage(body, options = {}) {
  const chatType = body?.chattype || 'single';
  if (chatType !== 'group') return false;

  // Thread/reply to prior bot message counts as explicit trigger.
  if (body?.quote) return false;

  const text = extractInboundText(body).trim();
  const hasMedia = ['image', 'file', 'video', 'mixed'].includes(String(body?.msgtype || ''));

  if (options.strictGroupAt === true) {
    const mentionLists = [
      ...toArray(body?.mentioned_list),
      ...toArray(body?.mention_list),
      ...toArray(body?.text?.mentioned_list),
      ...toArray(body?.text?.mention_list),
    ];
    if (mentionLists.length > 0) return !hasStructuredBotMention(body);
    if (hasStructuredBotMention(body)) return false;
    return !text.includes('@');
  }

  // Default: trust platform @bot delivery; still ignore empty non-media noise.
  if (!text && !hasMedia) return true;
  return false;
}

function toUnifiedIncomingMessage(payload, botId) {
  const msgType = payload?.msgtype || 'text';
  const fromUserId = payload?.from?.userid || payload?.from_userid || payload?.userid || 'wecom-user';
  const fromName = payload?.from?.name || fromUserId;
  const chatId = resolveChatId(payload);
  const normalizedBotId = String(botId || payload?.aibotid || '').trim();
  const text = extractInboundText(payload);

  return {
    id: payload?.msgid || `${PLUGIN_ID}-${Date.now()}`,
    platform: PLUGIN_ID,
    chatId,
    conversationId: buildConversationId(normalizedBotId, chatId),
    user: {
      id: buildUserId(normalizedBotId, fromUserId),
      displayName: fromName,
      platformUserId: fromUserId,
    },
    content: {
      type: msgType === 'command' ? 'command' : 'text',
      text,
    },
    timestamp: payload?.create_time ? payload.create_time * 1000 : Date.now(),
    raw: payload,
    _wecomMeta: {
      chatType: payload?.chattype || 'single',
      aibotId: payload?.aibotid || normalizedBotId,
      responseUrl: payload?.response_url || null,
    },
  };
}

module.exports = {
  extractInboundText,
  hasStructuredBotMention,
  shouldIgnoreGroupMessage,
  toUnifiedIncomingMessage,
};
