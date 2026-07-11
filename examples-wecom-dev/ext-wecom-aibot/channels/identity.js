const PLUGIN_ID = 'ext-wecom-aibot';

function normalizeBotId(botId) {
  return String(botId || '').trim();
}

function buildConversationId(botId, chatId) {
  const b = normalizeBotId(botId);
  const c = String(chatId || '').trim();
  return `${PLUGIN_ID}:${b}:${c}`;
}

function buildUserId(botId, wecomUserId) {
  const b = normalizeBotId(botId);
  const u = String(wecomUserId || '').trim();
  return `${PLUGIN_ID}:${b}:${u}`;
}

function resolveChatId(body) {
  const fromUserId = body?.from?.userid || body?.from_userid || body?.userid || 'wecom-user';
  if (body?.chattype === 'group' && body?.chatid) {
    return String(body.chatid);
  }
  return `dm:${fromUserId}`;
}

module.exports = {
  PLUGIN_ID,
  buildConversationId,
  buildUserId,
  resolveChatId,
};
