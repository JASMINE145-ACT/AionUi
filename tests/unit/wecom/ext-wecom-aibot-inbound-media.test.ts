import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const inboundMedia = require('../../../examples/ext-wecom-aibot/channels/inbound-media') as {
  saveInboundBuffer: (
    buffer: Buffer,
    preferredName: string,
    ctx: { botId: string; chatId: string }
  ) => { file_name: string; url: string; mime_type: string; file_size: number };
  buildInboundText: (
    body: Record<string, unknown>,
    attachments: Array<{ file_name: string }>
  ) => string;
  inboundContentType: (msgType: string, attachments: Array<{ file_name: string }>) => string;
  cleanupExpiredInboundFiles: (options?: { ttlMs?: number }) => number;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const inbound = require('../../../examples/ext-wecom-aibot/channels/inbound') as {
  toUnifiedIncomingMessage: (
    payload: Record<string, unknown>,
    botId: string,
    options?: {
      attachments?: Array<{ file_name: string; url: string; mime_type: string; file_size: number }>;
      text?: string;
      contentType?: string;
    }
  ) => {
    content: { type: string; text: string; attachments: unknown[] };
    attachments: unknown[];
  };
};

describe('ext-wecom-aibot inbound-media', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wecom-in-'));
  const ctx = { botId: 'bot-1', chatId: 'chat-1' };

  it('saves inbound xlsx to controlled temp dir', () => {
    const saved = inboundMedia.saveInboundBuffer(Buffer.from('xlsx'), 'quote.xlsx', ctx);
    expect(saved.file_name).toContain('quote.xlsx');
    expect(fs.existsSync(saved.url)).toBe(true);
    expect(saved.mime_type).toContain('spreadsheet');
    void tmpRoot;
  });

  it('builds user-visible text for downloaded file', () => {
    const text = inboundMedia.buildInboundText(
      { msgtype: 'file', file: { name: 'PT. Jinse7.1报价单.xlsx' } },
      [{ file_name: 'PT. Jinse7.1报价单.xlsx' }]
    );
    expect(text).toContain('[用户发送文件]');
    expect(text).toContain('PT. Jinse7.1报价单.xlsx');
  });

  it('maps file message to document content type', () => {
    expect(
      inboundMedia.inboundContentType('file', [{ file_name: 'a.xlsx' } as { file_name: string }])
    ).toBe('document');
  });

  it('toUnifiedIncomingMessage carries attachments for bridge', () => {
    const attachment = {
      file_name: 'quote.xlsx',
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      file_size: 100,
      url: path.join(tmpRoot, 'quote.xlsx'),
    };
    const unified = inbound.toUnifiedIncomingMessage(
      { msgtype: 'file', file: { name: 'quote.xlsx' }, from: { userid: 'u1' }, chattype: 'single' },
      'bot-1',
      {
        attachments: [attachment],
        text: '[用户发送文件] quote.xlsx',
        contentType: 'document',
      }
    );
    expect(unified.content.type).toBe('document');
    expect(unified.attachments).toHaveLength(1);
    expect(unified.content.attachments).toHaveLength(1);
  });

  it('rejects oversize inbound buffer', () => {
    expect(() =>
      inboundMedia.saveInboundBuffer(Buffer.alloc(21 * 1024 * 1024), 'big.xlsx', ctx)
    ).toThrow(/too large/);
  });

  it('rejects disallowed inbound extension', () => {
    expect(() => inboundMedia.saveInboundBuffer(Buffer.from('exe'), 'bad.exe', ctx)).toThrow(
      /not allowed/
    );
  });

  it('builds failure text when download fails', () => {
    const text = inboundMedia.buildInboundText(
      { msgtype: 'file', file: { name: 'quote.xlsx' } },
      [],
      ['download timeout']
    );
    expect(text).toContain('[文件接收失败]');
    expect(text).toContain('quote.xlsx');
  });

  it('cleanupExpiredInboundFiles removes old files', () => {
    const root = inboundMedia.saveInboundBuffer(Buffer.from('old'), 'old.xlsx', {
      botId: 'bot-clean',
      chatId: 'chat-clean',
    }).url;
    const stat = fs.statSync(root);
    fs.utimesSync(root, new Date(stat.atimeMs), new Date(Date.now() - 2 * 60 * 60 * 1000));
    const removed = inboundMedia.cleanupExpiredInboundFiles({ ttlMs: 60 * 60 * 1000 });
    expect(removed).toBeGreaterThan(0);
  });
});
