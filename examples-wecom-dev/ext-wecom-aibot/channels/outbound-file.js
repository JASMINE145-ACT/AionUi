const fs = require('fs');
const path = require('path');

/** P0 quotation-centric allowlist (WANd.WECOM.MEDIA.OUT.SECURITY.001). */
const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv', '.pdf', '.docx', '.txt']);
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const MIME_BY_EXT = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
};

const PATH_IN_TEXT_RE =
  /(?:[A-Za-z]:\\|\/)[^\s"'<>|*?]+\.(?:xlsx|xls|csv|pdf|docx|txt)\b/gi;

function auditOutboundFile(event, detail) {
  const safe = {
    event,
    basename: detail?.basename || null,
    ok: detail?.ok === true,
    reason: detail?.reason || null,
  };
  console.info('[ext-wecom-aibot] outbound-file', safe);
}

function uniqueResolvedPaths(paths) {
  const out = [];
  const seen = new Set();
  for (const raw of paths) {
    const text = String(raw || '').trim();
    if (!text) continue;
    const resolved = path.resolve(text);
    const key = resolved.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(resolved);
  }
  return out;
}

/** Known CCB install prefixes that may hold workspace/artifacts (SECURITY.001). */
function candidateInstallRoots() {
  const drive = process.env.SystemDrive || 'C:';
  return uniqueResolvedPaths([
    process.env.CCB_INSTALL_DIR,
    process.env.CCB_WANDING_HOME,
    process.env.CCB_WANDING_ROOT,
    path.join(drive, 'CCB-Wanding'),
    'C:\\CCB-Wanding',
    'D:\\CCB-Wanding',
  ]);
}

function defaultAllowedRoots() {
  const roots = [];
  const local = process.env.LOCALAPPDATA || process.env.HOME || process.env.USERPROFILE || '';
  if (local) {
    roots.push(path.join(local, 'CCB-Wanding', 'workspace'));
    roots.push(path.join(local, 'CCB-Wanding', 'artifacts'));
  }
  for (const envKey of ['CCB_WORKSPACE', 'AIONUI_WORKSPACE']) {
    const value = String(process.env[envKey] || '').trim();
    if (value) roots.push(value);
  }
  // Product install layout used by WanD quotation Excel output:
  // e.g. D:\CCB-Wanding\workspace\Wanding-Quotation_*.xlsx
  for (const installRoot of candidateInstallRoots()) {
    roots.push(path.join(installRoot, 'workspace'));
    roots.push(path.join(installRoot, 'artifacts'));
  }
  return uniqueResolvedPaths(roots);
}

function isPathInsideRoot(resolvedFile, resolvedRoot) {
  const rel = path.relative(resolvedRoot, resolvedFile);
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Validate a local outbound file path against allowlist / size / extension.
 * @returns {{ ok: true, absolutePath: string, fileName: string, mimeType: string, size: number }
 *          |{ ok: false, reason: string, basename?: string }}
 */
function validateOutboundFilePath(filePath, options = {}) {
  const raw = String(filePath || '').trim();
  if (!raw) {
    return { ok: false, reason: 'empty_path' };
  }

  let absolutePath;
  try {
    absolutePath = path.resolve(raw);
  } catch {
    return { ok: false, reason: 'invalid_path', basename: path.basename(raw) };
  }

  const basename = path.basename(absolutePath);
  const ext = path.extname(absolutePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    auditOutboundFile('reject', { basename, ok: false, reason: 'extension_not_allowed' });
    return { ok: false, reason: 'extension_not_allowed', basename };
  }

  const roots = (options.allowedRoots || defaultAllowedRoots()).map((root) => path.resolve(root));
  const inside = roots.some((root) => isPathInsideRoot(absolutePath, root));
  if (!inside) {
    auditOutboundFile('reject', { basename, ok: false, reason: 'outside_allowlist' });
    return { ok: false, reason: 'outside_allowlist', basename };
  }

  let stat;
  try {
    stat = fs.statSync(absolutePath);
  } catch {
    auditOutboundFile('reject', { basename, ok: false, reason: 'not_found' });
    return { ok: false, reason: 'not_found', basename };
  }

  if (!stat.isFile()) {
    auditOutboundFile('reject', { basename, ok: false, reason: 'not_a_file' });
    return { ok: false, reason: 'not_a_file', basename };
  }

  try {
    absolutePath = fs.realpathSync(absolutePath);
  } catch {
    auditOutboundFile('reject', { basename, ok: false, reason: 'realpath_failed' });
    return { ok: false, reason: 'realpath_failed', basename };
  }

  // Re-check allowlist after symlink resolution (SECURITY.001).
  const insideAfterRealpath = roots.some((root) => isPathInsideRoot(absolutePath, root));
  if (!insideAfterRealpath) {
    auditOutboundFile('reject', { basename, ok: false, reason: 'outside_allowlist' });
    return { ok: false, reason: 'outside_allowlist', basename };
  }

  const maxBytes = options.maxBytes || MAX_FILE_BYTES;
  if (stat.size > maxBytes) {
    auditOutboundFile('reject', { basename, ok: false, reason: 'oversize' });
    return { ok: false, reason: 'oversize', basename };
  }

  const mimeType = options.mimeType || MIME_BY_EXT[ext] || 'application/octet-stream';
  auditOutboundFile('accept', { basename, ok: true, reason: null });
  return {
    ok: true,
    absolutePath,
    fileName: options.fileName || basename,
    mimeType,
    size: stat.size,
  };
}

function extractCandidatePathsFromText(text) {
  const raw = String(text || '');
  const matches = raw.match(PATH_IN_TEXT_RE) || [];
  const unique = [];
  const seen = new Set();
  for (const match of matches) {
    const cleaned = match.replace(/[.,;:!?)]+$/, '');
    const key = path.resolve(cleaned).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(cleaned);
  }
  return unique;
}

/**
 * Extract and validate outbound files mentioned in assistant text.
 */
function resolveOutboundFilesFromText(text, options = {}) {
  const candidates = extractCandidatePathsFromText(text);
  const accepted = [];
  for (const candidate of candidates) {
    const result = validateOutboundFilePath(candidate, options);
    if (result.ok) accepted.push(result);
  }
  return accepted;
}

function resolveFileFromMessage(message, options = {}) {
  if (typeof message === 'string') return null;
  const messageType = String(message?.messageType || message?.type || '').toLowerCase();
  if (messageType !== 'file') return null;

  const filePath =
    message?.file_path ||
    message?.file_url ||
    message?.content?.file_path ||
    message?.content?.file_url ||
    '';
  const fileName = message?.file_name || message?.content?.file_name;
  const mimeType = message?.mime_type || message?.content?.mime_type;
  return validateOutboundFilePath(filePath, { ...options, fileName, mimeType });
}

/**
 * Pure send plan for CTX.001 / DEGRADE.001 (media before finish clear).
 * @returns {Array<{ type: 'stream'|'media'|'fallback', content?: string, finish?: boolean, file?: object, reason?: string }>}
 */
function planOutboundSend({ messageType, text, finish, fileMessage, allowlistOptions }) {
  const content = String(text || '');
  if (messageType === 'file') {
    const validated = fileMessage || { ok: false, reason: 'empty_path', basename: 'file' };
    if (!validated.ok) {
      const name = validated.basename || 'file';
      const fallback =
        content || `[文件发送失败] ${name}${validated.reason ? ` — ${validated.reason}` : ''}`;
      return [{ type: 'stream', content: fallback, finish: finish !== false }];
    }
    const steps = [];
    if (content) steps.push({ type: 'stream', content, finish: false });
    steps.push({ type: 'media', file: validated });
    if (finish !== false) steps.push({ type: 'stream', content: '', finish: true });
    return steps;
  }

  const autoFiles =
    finish !== false ? resolveOutboundFilesFromText(content, allowlistOptions || {}) : [];
  if (autoFiles.length > 0) {
    const steps = [{ type: 'stream', content, finish: false }];
    for (const file of autoFiles) steps.push({ type: 'media', file });
    steps.push({ type: 'stream', content: '', finish: true });
    return steps;
  }

  return [{ type: 'stream', content, finish: finish !== false }];
}

module.exports = {
  ALLOWED_EXTENSIONS,
  MAX_FILE_BYTES,
  MIME_BY_EXT,
  auditOutboundFile,
  defaultAllowedRoots,
  candidateInstallRoots,
  validateOutboundFilePath,
  extractCandidatePathsFromText,
  resolveOutboundFilesFromText,
  resolveFileFromMessage,
  planOutboundSend,
};
