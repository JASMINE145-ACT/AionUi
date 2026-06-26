import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import {
  deleteCcbAgent,
  getCcbAgent,
  listCcbAgents,
  saveCcbAgent,
} from '@/common/config/ccbAgents';

function withTempConfigDir(run: (dir: string) => Promise<void> | void) {
  const previous = process.env.CCB_WANDING_CONFIG_DIR;
  const dir = mkdtempSync(join(tmpdir(), 'ccb-wanding-agents-'));
  writeFileSync(join(dir, 'settings.json'), '{}\n', 'utf8');
  process.env.CCB_WANDING_CONFIG_DIR = dir;
  return Promise.resolve(run(dir)).finally(() => {
    if (previous === undefined) {
      delete process.env.CCB_WANDING_CONFIG_DIR;
    } else {
      process.env.CCB_WANDING_CONFIG_DIR = previous;
    }
  });
}

describe('ccbAgents', () => {
  afterEach(() => {
    delete process.env.CCB_WANDING_CONFIG_DIR;
  });

  it('round-trips agent md and sidecar files', async () => {
    await withTempConfigDir(async (dir) => {
      const saved = await saveCcbAgent({
        id: 'quotation-agent',
        name: 'quotation-agent',
        description: '报价助手',
        model: 'glm-5.1',
        permission_mode: 'plan',
        system_prompt: 'You are the quotation specialist.',
        guid_primary: true,
        avatar: '💰',
        sort_order: 1000,
        recommended_prompts: ['查直接50价格'],
        mcp_allowlist: ['quotation'],
        skills: { enabled: ['quote-helper'], disabled: [] },
        source: 'bundled',
      });

      expect(saved.id).toBe('quotation-agent');
      expect(saved.guid_primary).toBe(true);

      const listed = await listCcbAgents();
      expect(listed).toHaveLength(1);
      expect(listed[0]?.recommended_prompts).toEqual(['查直接50价格']);

      const loaded = await getCcbAgent('quotation-agent');
      expect(loaded?.system_prompt).toBe('You are the quotation specialist.');
      expect(loaded?.skills.enabled).toEqual(['quote-helper']);
      expect(loaded?.mcp_allowlist).toEqual(['quotation']);

      const md = readFileSync(join(dir, 'agents', 'quotation-agent.md'), 'utf8');
      expect(md).toContain('name: quotation-agent');
      expect(md).toContain('You are the quotation specialist.');

      const sidecar = JSON.parse(readFileSync(join(dir, 'agents', 'quotation-agent.aionui.json'), 'utf8'));
      expect(sidecar.guid_primary).toBe(true);
      expect(sidecar.agent_id).toBe('quotation-agent');
      expect(sidecar.claude_md).toBeUndefined();
    });
  });

  it('writes via tmp then rename for md and sidecar', async () => {
    await withTempConfigDir(async (dir) => {
      await saveCcbAgent({
        id: 'atomic-agent',
        name: 'atomic-agent',
        system_prompt: 'atomic body',
        recommended_prompts: [],
        mcp_allowlist: [],
        skills: { enabled: [], disabled: [] },
        source: 'user',
      });

      const agentsDir = join(dir, 'agents');
      expect(readFileSync(join(agentsDir, 'atomic-agent.md'), 'utf8')).toContain('atomic body');
      expect(readFileSync(join(agentsDir, 'atomic-agent.aionui.json'), 'utf8')).toContain('"agent_id"');
      expect(readdirSync(agentsDir).filter((file) => file.endsWith('.tmp'))).toHaveLength(0);
    });
  });

  it('deletes md and sidecar together', async () => {
    await withTempConfigDir(async (dir) => {
      await saveCcbAgent({
        id: 'delete-me',
        name: 'delete-me',
        recommended_prompts: [],
        mcp_allowlist: [],
        skills: { enabled: [], disabled: [] },
        source: 'user',
      });

      await deleteCcbAgent('delete-me');
      expect(await getCcbAgent('delete-me')).toBeNull();
      expect(readdirSync(join(dir, 'agents'))).toEqual([]);
    });
  });

  it('parses multiline YAML description blocks', async () => {
    await withTempConfigDir(async (dir) => {
      const agentsDir = join(dir, 'agents');
      mkdirSync(agentsDir, { recursive: true });
      writeFileSync(
        join(agentsDir, 'block-desc.md'),
        `---
name: block-desc
description: |
  第一行说明
  第二行说明
---
Body
`,
        'utf8'
      );
      writeFileSync(
        join(agentsDir, 'block-desc.aionui.json'),
        JSON.stringify({ schema_version: 1, agent_id: 'block-desc', source: 'bundled' }),
        'utf8'
      );

      const loaded = await getCcbAgent('block-desc');
      expect(loaded?.description).toBe('第一行说明\n第二行说明');
    });
  });

  it('folds claude_md-only profile into md body on save', async () => {
    await withTempConfigDir(async (dir) => {
      await saveCcbAgent({
        id: 'legacy-sidecar',
        name: 'legacy-sidecar',
        claude_md: 'Legacy specialist identity block.',
        recommended_prompts: [],
        mcp_allowlist: ['accurate'],
        skills: { enabled: [], disabled: [] },
        source: 'bundled',
      });

      const md = readFileSync(join(dir, 'agents', 'legacy-sidecar.md'), 'utf8');
      expect(md).toContain('Legacy specialist identity block.');
      expect(md).toContain('mcpServers:');
      expect(md).toContain('- accurate');

      const sidecar = JSON.parse(
        readFileSync(join(dir, 'agents', 'legacy-sidecar.aionui.json'), 'utf8'),
      );
      expect(sidecar.claude_md).toBeUndefined();

      const loaded = await getCcbAgent('legacy-sidecar');
      expect(loaded?.system_prompt).toBe('Legacy specialist identity block.');
      expect(loaded?.mcp_allowlist).toEqual(['accurate']);
    });
  });

  it('reads mcpServers from frontmatter when sidecar allowlist empty', async () => {
    await withTempConfigDir(async (dir) => {
      const agentsDir = join(dir, 'agents');
      mkdirSync(agentsDir, { recursive: true });
      writeFileSync(
        join(agentsDir, 'fm-mcp.md'),
        `---
name: fm-mcp
mcpServers:
  - quotation
---
Body
`,
        'utf8',
      );
      writeFileSync(
        join(agentsDir, 'fm-mcp.aionui.json'),
        JSON.stringify({ schema_version: 1, agent_id: 'fm-mcp', source: 'bundled' }),
        'utf8',
      );

      const loaded = await getCcbAgent('fm-mcp');
      expect(loaded?.mcp_allowlist).toEqual(['quotation']);
    });
  });
});
