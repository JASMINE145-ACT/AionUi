import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ccbMcpHealth config layer', () => {
  it('flags missing core MCP registration and passes when settings + sidecars align', async () => {
    const configDir = mkdtempSync(join(tmpdir(), 'ccb-health-'));
    const agentsDir = join(configDir, 'agents');
    mkdirSync(agentsDir, { recursive: true });

    const wandingRoot = mkdtempSync(join(tmpdir(), 'ccb-wanding-'));
    mkdirSync(join(wandingRoot, 'python'), { recursive: true });
    writeFileSync(join(wandingRoot, 'python', 'main.py'), '# probe stub\n', 'utf8');

    writeFileSync(
      join(configDir, 'settings.json'),
      JSON.stringify({
        mcpServers: {
          quotation: {
            command: 'node',
            args: ['q.js'],
            env: { CCB_PROJECT_ROOT: wandingRoot },
          },
          accurate: { command: 'python', args: ['a.py'] },
          'office-word': { command: 'python', args: ['w.py'] },
          excel: { command: 'python', args: ['e.py'] },
        },
      }),
      'utf8'
    );

    for (const agentId of ['word-creator', 'excel-creator', 'quotation-agent', 'accurate-agent', 'wande-orchestrator']) {
      writeFileSync(join(agentsDir, `${agentId}.md`), `---\nname: ${agentId}\n---\n`, 'utf8');
      const allow =
        agentId === 'word-creator'
          ? ['office-word']
          : agentId === 'excel-creator'
            ? ['excel']
            : agentId === 'quotation-agent'
              ? ['quotation']
              : agentId === 'accurate-agent'
                ? ['accurate']
                : [];
      writeFileSync(
        join(agentsDir, `${agentId}.aionui.json`),
        JSON.stringify({ mcp_allowlist: allow }),
        'utf8'
      );
    }

    const previous = process.env.CCB_WANDING_CONFIG_DIR;
    process.env.CCB_WANDING_CONFIG_DIR = configDir;
    try {
      const { runCcbMcpHealthCheck } = await import('@/common/config/ccbMcpHealth');
      const report = await runCcbMcpHealthCheck({ probe: false });
      expect(report.config.ok).toBe(true);
      expect(report.config.items.some((item) => item.id === 'mcp:quotation' && item.ok)).toBe(true);
      expect(
        report.config.items.some((item) => item.id === 'quotation.env.CCB_PROJECT_ROOT' && item.ok)
      ).toBe(true);
      expect(report.config.items.some((item) => item.id === 'word-creator' && item.ok)).toBe(true);
    } finally {
      if (previous === undefined) {
        delete process.env.CCB_WANDING_CONFIG_DIR;
      } else {
        process.env.CCB_WANDING_CONFIG_DIR = previous;
      }
    }
  });
});
