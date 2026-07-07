import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { collectCcbMcpHealthFailedItems } from '@/common/config/ccbMcpHealth';

describe('ccbMcpHealth config layer', () => {
  it('flags missing core MCP registration and passes when settings + sidecars align', async () => {
    const configDir = mkdtempSync(join(tmpdir(), 'ccb-wanding-health-'));
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
          'price-library': { command: 'node', args: ['pl.js'] },
        },
      }),
      'utf8'
    );

    for (const agentId of [
      'word-creator',
      'excel-creator',
      'quotation-agent',
      'accurate-agent',
      'wande-orchestrator',
      'price-library-agent',
    ]) {
      writeFileSync(join(agentsDir, `${agentId}.md`), `---\nname: ${agentId}\n---\n`, 'utf8');
      const allow =
        agentId === 'word-creator'
          ? ['office-word']
          : agentId === 'excel-creator'
            ? ['excel']
            : agentId === 'quotation-agent'
              ? ['quotation', 'excel']
              : agentId === 'accurate-agent'
                ? ['accurate']
                : agentId === 'price-library-agent'
                  ? ['price-library']
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
      expect(report.agents?.ok).toBe(true);
      expect(report.config.items.some((item) => item.id === 'mcp:quotation' && item.ok)).toBe(true);
      expect(
        report.config.items.some((item) => item.id === 'quotation.env.CCB_PROJECT_ROOT' && item.ok)
      ).toBe(true);
      expect(report.agents?.items.some((item) => item.id === 'word-creator' && item.ok)).toBe(true);
      expect(collectCcbMcpHealthFailedItems(report)).toEqual([]);
    } finally {
      if (previous === undefined) {
        delete process.env.CCB_WANDING_CONFIG_DIR;
      } else {
        process.env.CCB_WANDING_CONFIG_DIR = previous;
      }
    }
  });

  it('splits config, files, and agents into separate layer results', async () => {
    const configDir = mkdtempSync(join(tmpdir(), 'ccb-wanding-health-split-'));
    const agentsDir = join(configDir, 'agents');
    mkdirSync(agentsDir, { recursive: true });

    writeFileSync(
      join(configDir, 'settings.json'),
      JSON.stringify({
        mcpServers: {
          quotation: { command: 'node', args: ['q.js'] },
          accurate: { command: 'python', args: ['a.py'] },
          'office-word': { command: 'python', args: ['w.py'] },
          excel: { command: 'python', args: ['e.py'] },
          'price-library': { command: 'node', args: ['pl.js'] },
        },
      }),
      'utf8'
    );

    writeFileSync(join(agentsDir, 'quotation-agent.md'), '---\nname: quotation-agent\n---\n', 'utf8');
    writeFileSync(
      join(agentsDir, 'quotation-agent.aionui.json'),
      JSON.stringify({ mcp_allowlist: ['quotation', 'excel'] }),
      'utf8'
    );

    const previous = process.env.CCB_WANDING_CONFIG_DIR;
    process.env.CCB_WANDING_CONFIG_DIR = configDir;
    try {
      const { runCcbMcpHealthCheck } = await import('@/common/config/ccbMcpHealth');
      const report = await runCcbMcpHealthCheck({ probe: false });
      expect(report.config.items.every((item) => item.layer === 'config')).toBe(true);
      expect(report.agents?.items.every((item) => item.layer === 'agents')).toBe(true);
      expect(report.config.items.some((item) => item.id === 'quotation.env.CCB_PROJECT_ROOT' && !item.ok)).toBe(
        true
      );
    } finally {
      if (previous === undefined) {
        delete process.env.CCB_WANDING_CONFIG_DIR;
      } else {
        process.env.CCB_WANDING_CONFIG_DIR = previous;
      }
    }
  });

  it('optional layer warns on missing ppt-master skill without failing report', async () => {
    const configDir = mkdtempSync(join(tmpdir(), 'ccb-wanding-health-opt-'));
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
          'price-library': { command: 'node', args: ['pl.js'] },
        },
      }),
      'utf8'
    );

    for (const agentId of [
      'word-creator',
      'excel-creator',
      'quotation-agent',
      'accurate-agent',
      'wande-orchestrator',
      'price-library-agent',
    ]) {
      writeFileSync(join(agentsDir, `${agentId}.md`), `---\nname: ${agentId}\n---\n`, 'utf8');
      const allow =
        agentId === 'word-creator'
          ? ['office-word']
          : agentId === 'excel-creator'
            ? ['excel']
            : agentId === 'quotation-agent'
              ? ['quotation', 'excel']
              : agentId === 'accurate-agent'
                ? ['accurate']
                : agentId === 'price-library-agent'
                  ? ['price-library']
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
      const { runCcbMcpHealthCheck, collectCcbMcpHealthFailedItems, collectCcbMcpHealthWarnItems } =
        await import('@/common/config/ccbMcpHealth');
      const report = await runCcbMcpHealthCheck({ probe: false });
      expect(report.optional?.ok).toBe(true);
      expect(report.ok).toBe(true);
      expect(
        report.optional?.items.some((item) => item.id === 'ppt-master:config-skill' && !item.ok && item.warn)
      ).toBe(true);
      expect(report.optional?.items.some((item) => item.id === 'exa:http' && item.ok)).toBe(true);
      expect(collectCcbMcpHealthFailedItems(report)).toEqual([]);
      expect(collectCcbMcpHealthWarnItems(report).length).toBeGreaterThan(0);
    } finally {
      if (previous === undefined) {
        delete process.env.CCB_WANDING_CONFIG_DIR;
      } else {
        process.env.CCB_WANDING_CONFIG_DIR = previous;
      }
    }
  });

  it('optional exa:http treats HTTP 405 as reachable (streamable MCP rejects HEAD/GET)', async () => {
    const configDir = mkdtempSync(join(tmpdir(), 'ccb-wanding-health-exa405-'));
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
          exa: { type: 'http', url: 'https://mcp.exa.ai/mcp' },
        },
      }),
      'utf8'
    );

    for (const agentId of [
      'word-creator',
      'excel-creator',
      'quotation-agent',
      'accurate-agent',
      'wande-orchestrator',
      'price-library-agent',
    ]) {
      writeFileSync(join(agentsDir, `${agentId}.md`), `---\nname: ${agentId}\n---\n`, 'utf8');
      const allow =
        agentId === 'word-creator'
          ? ['office-word']
          : agentId === 'excel-creator'
            ? ['excel']
            : agentId === 'quotation-agent'
              ? ['quotation', 'excel']
              : agentId === 'accurate-agent'
                ? ['accurate']
                : agentId === 'price-library-agent'
                  ? ['price-library']
                  : [];
      writeFileSync(
        join(agentsDir, `${agentId}.aionui.json`),
        JSON.stringify({ mcp_allowlist: allow }),
        'utf8'
      );
    }

    const fetchMock = async () => ({ status: 405 }) as Response;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    const previous = process.env.CCB_WANDING_CONFIG_DIR;
    process.env.CCB_WANDING_CONFIG_DIR = configDir;
    try {
      const { runCcbMcpHealthCheck, collectCcbMcpHealthWarnItems } = await import(
        '@/common/config/ccbMcpHealth'
      );
      const report = await runCcbMcpHealthCheck({ probe: false });
      const exaItem = report.optional?.items.find((item) => item.id === 'exa:http');
      expect(exaItem?.ok).toBe(true);
      expect(exaItem?.warn).toBeFalsy();
      expect(exaItem?.detail).toContain('405');
      expect(collectCcbMcpHealthWarnItems(report).every((item) => item.id !== 'exa:http')).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
      if (previous === undefined) {
        delete process.env.CCB_WANDING_CONFIG_DIR;
      } else {
        process.env.CCB_WANDING_CONFIG_DIR = previous;
      }
    }
  });
});
