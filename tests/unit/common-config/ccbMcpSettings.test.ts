import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isCcbWandingInstallPresent } from '@/common/config/ccbWandingRuntimeNode';

describe('ccbMcpSettings mapping', () => {
  it('isCcbWandingInstallPresent is true when settings.json exists under CCB config dir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ccb-mcp-authority-'));
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ mcpServers: {} }), 'utf8');

    const previous = process.env.CCB_WANDING_CONFIG_DIR;
    process.env.CCB_WANDING_CONFIG_DIR = dir;
    try {
      expect(isCcbWandingInstallPresent(dir)).toBe(true);
    } finally {
      if (previous === undefined) {
        delete process.env.CCB_WANDING_CONFIG_DIR;
      } else {
        process.env.CCB_WANDING_CONFIG_DIR = previous;
      }
    }
  });
});

describe('ccbMcpSettings list', () => {
  it('maps settings.json servers to IMcpServer with disabled flag', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ccb-mcp-list-'));
    writeFileSync(
      join(dir, 'settings.json'),
      JSON.stringify({
        mcpServers: {
          quotation: { type: 'stdio', command: 'node', args: ['q.js'] },
          exa: { type: 'http', url: 'https://example.com/mcp' },
        },
        disabledMcpjsonServers: ['exa'],
      }),
      'utf8'
    );

    const { listCcbMcpServers } = await import('@/common/config/ccbMcpSettings');
    const servers = await listCcbMcpServers(dir);
    const byName = Object.fromEntries(servers.map((server) => [server.name, server]));

    expect(byName.quotation?.enabled).toBe(true);
    expect(byName.exa?.enabled).toBe(false);
    expect(byName.quotation?.builtin).toBe(true);
    expect(byName.quotation?.id).toBe('ccb-mcp:quotation');
  });
});
