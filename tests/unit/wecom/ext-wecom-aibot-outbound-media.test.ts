import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Prefer packaged examples/ tree (same as other wecom unit tests); keep SYNC.001 with dev.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const outboundFile = require('../../../examples/ext-wecom-aibot/channels/outbound-file') as {
  defaultAllowedRoots: () => string[];
  validateOutboundFilePath: (
    filePath: string,
    options?: { allowedRoots?: string[]; maxBytes?: number; fileName?: string }
  ) =>
    | { ok: true; absolutePath: string; fileName: string; mimeType: string; size: number }
    | { ok: false; reason: string; basename?: string };
  resolveOutboundFilesFromText: (
    text: string,
    options?: { allowedRoots?: string[] }
  ) => Array<{ ok: true; absolutePath: string; fileName: string }>;
  resolveFileFromMessage: (
    message: Record<string, unknown>,
    options?: { allowedRoots?: string[] }
  ) => { ok: boolean; reason?: string; fileName?: string; basename?: string };
  extractCandidatePathsFromText: (text: string) => string[];
  planOutboundSend: (input: {
    messageType: string;
    text: string;
    finish: boolean;
    fileMessage?: { ok: boolean; fileName?: string; basename?: string; reason?: string };
    allowlistOptions?: { allowedRoots?: string[] };
  }) => Array<{ type: string; content?: string; finish?: boolean; file?: { fileName?: string } }>;
};

describe('ext-wecom-aibot outbound-file (SECURITY.001)', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wecom-out-'));
  const allowedRoot = path.join(tmpRoot, 'workspace');
  const goodFile = path.join(allowedRoot, 'Wanding-Quotation_20260711.xlsx');

  fs.mkdirSync(allowedRoot, { recursive: true });
  fs.writeFileSync(goodFile, 'fake-xlsx');

  it('accepts allowlisted xlsx under workspace root', () => {
    const result = outboundFile.validateOutboundFilePath(goodFile, { allowedRoots: [allowedRoot] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fileName).toBe('Wanding-Quotation_20260711.xlsx');
      expect(result.mimeType).toContain('spreadsheet');
    }
  });

  it('rejects paths outside allowlist', () => {
    const outside = path.join(tmpRoot, 'secret.xlsx');
    fs.writeFileSync(outside, 'nope');
    const result = outboundFile.validateOutboundFilePath(outside, { allowedRoots: [allowedRoot] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('outside_allowlist');
  });

  it('rejects disallowed extensions', () => {
    const exe = path.join(allowedRoot, 'payload.exe');
    fs.writeFileSync(exe, 'mz');
    const result = outboundFile.validateOutboundFilePath(exe, { allowedRoots: [allowedRoot] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('extension_not_allowed');
  });

  it('rejects oversize files', () => {
    const result = outboundFile.validateOutboundFilePath(goodFile, {
      allowedRoots: [allowedRoot],
      maxBytes: 4,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('oversize');
  });

  it('extracts absolute paths from assistant text', () => {
    const text = `报价单已生成：${goodFile} 请查收`;
    const paths = outboundFile.extractCandidatePathsFromText(text);
    expect(paths.some((p) => p.includes('Wanding-Quotation_20260711.xlsx'))).toBe(true);
    const resolved = outboundFile.resolveOutboundFilesFromText(text, { allowedRoots: [allowedRoot] });
    expect(resolved).toHaveLength(1);
  });

  it('defaultAllowedRoots includes CCB install workspace layout', () => {
    const roots = outboundFile.defaultAllowedRoots().map((r) => r.toLowerCase());
    const hasInstallWorkspace = roots.some(
      (r) => r.includes(`${path.sep}ccb-wanding${path.sep}workspace`.toLowerCase()) || r.endsWith('\\ccb-wanding\\workspace') || r.endsWith('/ccb-wanding/workspace')
    );
    expect(hasInstallWorkspace).toBe(true);
    // Product path used by quotation-agent examples
    const productWorkspace = path.resolve('D:\\CCB-Wanding\\workspace').toLowerCase();
    expect(roots.includes(productWorkspace) || roots.some((r) => r.includes('ccb-wanding'))).toBe(true);
  });

  it('accepts quotation xlsx under D:\\\\CCB-Wanding\\\\workspace when present in allowlist', () => {
    const productRoot = path.join(tmpRoot, 'CCB-Wanding', 'workspace');
    fs.mkdirSync(productRoot, { recursive: true });
    const quote = path.join(productRoot, 'Wanding-Quotation_live.xlsx');
    fs.writeFileSync(quote, 'xlsx');
    const result = outboundFile.validateOutboundFilePath(quote, { allowedRoots: [productRoot] });
    expect(result.ok).toBe(true);
  });
});

describe('ext-wecom-aibot outbound plan (CTX.001 / DEGRADE.001)', () => {
  it('places media before finish=true for typed file messages', () => {
    const plan = outboundFile.planOutboundSend({
      messageType: 'file',
      text: '报价单',
      finish: true,
      fileMessage: { ok: true, fileName: 'a.xlsx' },
    });
    expect(plan.map((s) => s.type)).toEqual(['stream', 'media', 'stream']);
    expect(plan[0]).toMatchObject({ finish: false, content: '报价单' });
    expect(plan[1]).toMatchObject({ type: 'media' });
    expect(plan[2]).toMatchObject({ finish: true, content: '' });
  });

  it('degrades to text when file validation fails', () => {
    const plan = outboundFile.planOutboundSend({
      messageType: 'file',
      text: '',
      finish: true,
      fileMessage: { ok: false, reason: 'outside_allowlist', basename: 'evil.xlsx' },
    });
    expect(plan).toHaveLength(1);
    expect(plan[0].type).toBe('stream');
    expect(plan[0].content).toContain('文件发送失败');
    expect(plan[0].content).toContain('outside_allowlist');
    expect(plan[0].finish).toBe(true);
  });

  it('keeps plain text finish behavior when no paths', () => {
    const plan = outboundFile.planOutboundSend({
      messageType: 'text',
      text: 'hello',
      finish: true,
    });
    expect(plan).toEqual([{ type: 'stream', content: 'hello', finish: true }]);
  });
});

describe('ext-wecom-aibot outbound SYNC.001', () => {
  it('dev and examples outbound-file exports stay aligned', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dev = require('../../../examples-wecom-dev/ext-wecom-aibot/channels/outbound-file');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const packaged = require('../../../examples/ext-wecom-aibot/channels/outbound-file');
    expect(Object.keys(dev).sort()).toEqual(Object.keys(packaged).sort());
    expect(dev.MAX_FILE_BYTES).toBe(packaged.MAX_FILE_BYTES);
  });
});
