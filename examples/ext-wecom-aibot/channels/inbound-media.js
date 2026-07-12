const fs = require('fs');
const path = require('path');
const os = require('os');

/** WANd.WECOM.MEDIA.IN.001 — controlled temp storage for inbound downloads. */
const MAX_INBOUND_BYTES = 20 * 1024 * 1024;
const INBOUND_TTL_MS = 60 * 60 * 1000;
const ALLOWED_INBOUND_EXTENSIONS = new Set([
  '.xlsx',
  '.xls',
  '.csv',
  '.pdf',
  '.docx',
  '.txt',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
]);

const MIME_BY_EXT = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

function auditInbound(event, detail) {
  console.info('[ext-wecom-aibot] inbound-media', {
    event,
    basename: detail?.basename || null,
    ok: detail?.ok === true,
    reason: detail?.reason || null,
  });
}

function defaultInboundRoot(botId, chatId) {
  const local = process.env.LOCALAPPDATA || os.homedir();
  const safeBot = String(botId || 'bot').replace(/[^\w.-]+/g, '_');
  const safeChat = String(chatId || 'chat').replace(/[^\w.-]+/g, '_');
  return path.join(local, 'CCB-Wanding', 'wecom-inbound', safeBot, safeChat);
}

function sanitizeFilename(name, fallbackExt = '.bin') {
  const raw = String(name || 'inbound').trim() || 'inbound';
  const base = path.basename(raw).replace(/[^\w.\-() \u4e00-\u9fff]+/g, '_');
  const ext = path.extname(base).toLowerCase() || fallbackExt;
  const stem = path.basename(base, path.extname(base)) || 'inbound';
  return `${stem}${ext}`;
}

function isAllowedInboundExt(ext) {
  return ALLOWED_INBOUND_EXTENSIONS.has(String(ext || '').toLowerCase());
}

function saveInboundBuffer(buffer, preferredName, ctx) {
  const ext = path.extname(preferredName || '').toLowerCase() || '.bin';
  if (!isAllowedInboundExt(ext)) {
    auditInbound('reject', { basename: preferredName, ok: false, reason: 'extension_not_allowed' });
    throw new Error(`inbound extension not allowed: ${ext}`);
  }
  if (!buffer || buffer.length > MAX_INBOUND_BYTES) {
    auditInbound('reject', { basename: preferredName, ok: false, reason: 'oversize' });
    throw new Error('inbound file too large');
  }

  const root = defaultInboundRoot(ctx.botId, ctx.chatId);
  fs.mkdirSync(root, { recursive: true });
  const fileName = sanitizeFilename(preferredName, ext);
  const stamp = Date.now();
  const absolutePath = path.join(root, `${stamp}-${fileName}`);
  fs.writeFileSync(absolutePath, buffer);

  auditInbound('saved', { basename: path.basename(absolutePath), ok: true });
  return {
    file_name: path.basename(absolutePath),
    mime_type: MIME_BY_EXT[ext] || 'application/octet-stream',
    file_size: buffer.length,
    url: absolutePath,
    local_path: absolutePath,
  };
}

async function downloadMediaPart(client, part, ctx) {
  const msgType = part?.msgtype;
  if (msgType === 'file') {
    const url = part?.file?.url;
    if (!url) return null;
    const { buffer, filename } = await client.downloadFile(url, part.file?.aeskey);
    const preferred = filename || part.file?.name || 'inbound-file';
    return saveInboundBuffer(buffer, preferred, ctx);
  }
  if (msgType === 'image') {
    const url = part?.image?.url;
    if (!url) return null;
    const { buffer, filename } = await client.downloadFile(url, part.image?.aeskey);
    const preferred = filename || 'inbound-image.jpg';
    return saveInboundBuffer(buffer, preferred, ctx);
  }
  return null;
}

/**
 * Download inbound file/image from WeCom frame body into controlled temp dir.
 * @returns {Promise<Array<{file_name,mime_type,file_size,url,local_path}>>}
 */
async function resolveInboundAttachments(client, body, ctx) {
  if (!client || !body) return [];
  const msgType = String(body?.msgtype || '');
  const attachments = [];
  const failures = [];

  try {
    if (msgType === 'file' || msgType === 'image') {
      const saved = await downloadMediaPart(client, body, ctx);
      if (saved) attachments.push(saved);
    } else if (msgType === 'mixed') {
      const items = Array.isArray(body?.mixed?.msg_item) ? body.mixed.msg_item : [];
      for (const item of items) {
        if (item?.msgtype === 'text') continue;
        try {
          const saved = await downloadMediaPart(client, item, ctx);
          if (saved) attachments.push(saved);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          auditInbound('part_failed', { ok: false, reason });
          failures.push(reason);
        }
      }
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    auditInbound('download_failed', { ok: false, reason });
    failures.push(reason);
  }

  return { attachments, failures };
}

function cleanupExpiredInboundFiles(options = {}) {
  const ttlMs = options.ttlMs || INBOUND_TTL_MS;
  const roots = [];
  const local = process.env.LOCALAPPDATA || os.homedir();
  const base = path.join(local, 'CCB-Wanding', 'wecom-inbound');
  if (!fs.existsSync(base)) return 0;

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else roots.push(full);
    }
  };
  walk(base);

  const cutoff = Date.now() - ttlMs;
  let removed = 0;
  for (const filePath of roots) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        removed += 1;
      }
    } catch {
      // ignore cleanup errors
    }
  }
  return removed;
}

function inboundContentType(msgType, attachments) {
  if (attachments?.length) {
    const hasDoc = attachments.some((a) => {
      const ext = path.extname(a.file_name || '').toLowerCase();
      return ['.xlsx', '.xls', '.csv', '.pdf', '.docx', '.txt'].includes(ext);
    });
    return hasDoc ? 'document' : 'photo';
  }
  if (msgType === 'file') return 'document';
  if (msgType === 'image') return 'photo';
  return 'text';
}

function buildInboundText(body, attachments, failures = []) {
  const base = require('./inbound').extractInboundText(body).trim();
  if (attachments?.length === 1) {
    const name = attachments[0].file_name || 'file';
    return base && !base.startsWith('[文件]') && !base.startsWith('[图片]')
      ? base
      : `[用户发送文件] ${name}`;
  }
  if (attachments?.length > 1) {
    const names = attachments.map((a) => a.file_name).filter(Boolean).join(', ');
    return `[用户发送文件] ${names}`;
  }
  if (failures?.length) {
    const hint = body?.file?.name || body?.image?.url || 'media';
    return `[文件接收失败] ${hint}`;
  }
  if (base && !base.startsWith('[文件]') && !base.startsWith('[图片]')) return base;
  return base || '[用户发送媒体]';
}

module.exports = {
  MAX_INBOUND_BYTES,
  INBOUND_TTL_MS,
  ALLOWED_INBOUND_EXTENSIONS,
  defaultInboundRoot,
  resolveInboundAttachments,
  cleanupExpiredInboundFiles,
  inboundContentType,
  buildInboundText,
  saveInboundBuffer,
};
