import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CCB_AGENTS_UNIFIED_FLAG,
  migrateAssistantProfilesToCcbAgents,
  migrateAssistantProfilesToCcbAgentsWithFlag,
  repairGlobalRouterCatalog,
  repairOfficeAgentAgentTypeIds,
  repairOfficePresetDelegatable,
  repairWanDSpecialistGuidCards,
  repairWanDSubagentMcpServers,
} from '@/common/config/ccbAgentMigration';
import { getCcbAgent, saveCcbAgent } from '@/common/config/ccbAgents';

function withTempConfigDir(run: (dir: string) => Promise<void> | void) {
  const previous = process.env.CCB_WANDING_CONFIG_DIR;
  const dir = mkdtempSync(join(tmpdir(), 'ccb-wanding-agent-migration-'));
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

function writeLegacyProfile(dir: string, id: string, profile: Record<string, unknown>): void {
  const profilesDir = join(dir, 'assistants');
  mkdirSync(profilesDir, { recursive: true });
  writeFileSync(join(profilesDir, `${id}.json`), `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
}

describe('ccbAgentMigration', () => {
  afterEach(() => {
    delete process.env.CCB_WANDING_CONFIG_DIR;
  });

  it('migrates legacy assistant profiles into agent md and sidecar files', async () => {
    await withTempConfigDir(async (dir) => {
      writeLegacyProfile(dir, 'quote-agent', {
        schema_version: 1,
        id: 'quote-agent',
        name: 'Quote Agent',
        enabled: true,
        source: 'user',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        instructions: {
          system_prompt: 'You quote prices.',
          claude_md: '# Quote rules',
        },
        recommended_prompts: ['查价格'],
        defaults: {
          model: 'glm-5.1',
          permission_mode: 'plan',
          skills: { enabled: ['quote-helper'], disabled: [] },
          mcp: { enabled: ['quotation'], disabled: [] },
        },
      });

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const report = await migrateAssistantProfilesToCcbAgents(dir, { dryRun: false });

      expect(report?.profiles_written).toEqual(['quote-agent']);
      expect(report?.profiles_skipped).toEqual([]);
      expect(existsSync(join(dir, 'agents', 'quote-agent.md'))).toBe(true);
      expect(existsSync(join(dir, 'agents', 'quote-agent.aionui.json'))).toBe(true);

      const agent = await getCcbAgent('quote-agent');
      expect(agent?.system_prompt).toBe('You quote prices.');
      expect(agent?.claude_md).toBeUndefined();
      expect(agent?.mcp_allowlist).toEqual(['quotation']);

      expect(infoSpy).toHaveBeenCalledWith(
        '[migration.ccbAgentsUnified] id=quote-agent action=write reason=migrated'
      );
      infoSpy.mockRestore();
    });
  });

  it('dry-run logs write without creating agent files', async () => {
    await withTempConfigDir(async (dir) => {
      writeLegacyProfile(dir, 'dry-run-agent', {
        schema_version: 1,
        id: 'dry-run-agent',
        name: 'Dry Run Agent',
        enabled: true,
        source: 'user',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        instructions: {},
        recommended_prompts: [],
        defaults: {
          skills: { enabled: [], disabled: [] },
          mcp: { enabled: [], disabled: [] },
        },
      });

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const report = await migrateAssistantProfilesToCcbAgents(dir, { dryRun: true });

      expect(report?.profiles_written).toEqual(['dry-run-agent']);
      expect(existsSync(join(dir, 'agents', 'dry-run-agent.md'))).toBe(false);
      expect(infoSpy).toHaveBeenCalledWith(
        '[migration.ccbAgentsUnified] id=dry-run-agent action=write reason=dry_run'
      );
      infoSpy.mockRestore();
    });
  });

  it('skips profiles that already have agent records', async () => {
    await withTempConfigDir(async (dir) => {
      writeLegacyProfile(dir, 'existing-agent', {
        schema_version: 1,
        id: 'existing-agent',
        name: 'Existing Agent',
        enabled: true,
        source: 'user',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        instructions: { system_prompt: 'legacy prompt' },
        recommended_prompts: [],
        defaults: {
          skills: { enabled: [], disabled: [] },
          mcp: { enabled: [], disabled: [] },
        },
      });

      mkdirSync(join(dir, 'agents'), { recursive: true });
      writeFileSync(
        join(dir, 'agents', 'existing-agent.md'),
        '---\nname: existing-agent\n---\n\nAlready migrated.\n',
        'utf8'
      );
      writeFileSync(
        join(dir, 'agents', 'existing-agent.aionui.json'),
        `${JSON.stringify(
          {
            schema_version: 1,
            agent_id: 'existing-agent',
            recommended_prompts: [],
            mcp_allowlist: [],
            skills: { enabled: [], disabled: [] },
            source: 'user',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
          null,
          2
        )}\n`,
        'utf8'
      );

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const report = await migrateAssistantProfilesToCcbAgents(dir, { dryRun: false });

      expect(report?.profiles_written).toEqual([]);
      expect(report?.profiles_skipped).toEqual([{ id: 'existing-agent', reason: 'agent_exists' }]);
      expect(readFileSync(join(dir, 'agents', 'existing-agent.md'), 'utf8')).toContain('Already migrated.');
      expect(infoSpy).toHaveBeenCalledWith(
        '[migration.ccbAgentsUnified] id=existing-agent action=skip reason=agent_exists'
      );
      infoSpy.mockRestore();
    });
  });

  it('sets migration flag after successful backend migration', async () => {
    await withTempConfigDir(async (dir) => {
      writeLegacyProfile(dir, 'flag-agent', {
        schema_version: 1,
        id: 'flag-agent',
        name: 'Flag Agent',
        enabled: true,
        source: 'user',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        instructions: {},
        recommended_prompts: [],
        defaults: {
          skills: { enabled: [], disabled: [] },
          mcp: { enabled: [], disabled: [] },
        },
      });

      const configFile = {
        get: vi.fn().mockResolvedValue(false),
        set: vi.fn().mockResolvedValue(undefined),
      };

      await expect(migrateAssistantProfilesToCcbAgentsWithFlag(configFile as never)).resolves.toBe(true);
      expect(configFile.set).toHaveBeenCalledWith(CCB_AGENTS_UNIFIED_FLAG, true);
      expect(existsSync(join(dir, 'agents', 'flag-agent.md'))).toBe(true);
    });
  });

  it('repairWanDSubagentMcpServers adds mcpServers frontmatter to live agent md', async () => {
    await withTempConfigDir(async (dir) => {
      const agentsDir = join(dir, 'agents');
      mkdirSync(agentsDir, { recursive: true });
      writeFileSync(
        join(agentsDir, 'quotation-agent.md'),
        `---
name: quotation-agent
description: "quote"
---

body`,
        'utf8'
      );

      const { repaired } = await repairWanDSubagentMcpServers(dir);
      expect(repaired).toEqual(['quotation-agent']);
      const updated = readFileSync(join(agentsDir, 'quotation-agent.md'), 'utf8');
      expect(updated).toContain('mcpServers:');
      expect(updated).toContain('- quotation');
    });
  });

  it('repairGlobalRouterCatalog hides orchestrator from Guid and enables office delegation', async () => {
    await withTempConfigDir(async (dir) => {
      await saveCcbAgent({
        id: 'wande-orchestrator',
        name: 'Router',
        model: null,
        permission_mode: null,
        recommended_prompts: [],
        mcp_allowlist: [],
        skills: { enabled: [], disabled: [] },
        enabled: true,
        source: 'bundled',
        delegatable: true,
        guid_primary: true,
      });
      await saveCcbAgent({
        id: 'ppt-creator',
        name: 'PPT',
        model: null,
        permission_mode: null,
        recommended_prompts: [],
        mcp_allowlist: [],
        skills: { enabled: [], disabled: [] },
        enabled: true,
        source: 'bundled',
        delegatable: false,
        guid_primary: true,
      });

      const { repaired } = await repairGlobalRouterCatalog(dir);
      expect(repaired.sort()).toEqual(['ppt-creator', 'wande-orchestrator']);
      expect((await getCcbAgent('wande-orchestrator'))?.guid_primary).toBe(false);
      expect((await getCcbAgent('ppt-creator'))?.delegatable).toBe(true);
    });
  });

  it('repairWanDSpecialistGuidCards enables Guid cards for quotation and accurate', async () => {
    await withTempConfigDir(async (dir) => {
      await saveCcbAgent({
        id: 'quotation-agent',
        name: 'quotation-agent',
        model: null,
        permission_mode: null,
        recommended_prompts: [],
        mcp_allowlist: ['quotation'],
        skills: { enabled: [], disabled: [] },
        enabled: true,
        source: 'bundled',
        delegatable: true,
        guid_primary: false,
      });
      await saveCcbAgent({
        id: 'accurate-agent',
        name: 'accurate-agent',
        model: null,
        permission_mode: null,
        recommended_prompts: [],
        mcp_allowlist: ['accurate'],
        skills: { enabled: [], disabled: [] },
        enabled: true,
        source: 'bundled',
        delegatable: true,
        guid_primary: false,
      });

      const { repaired } = await repairWanDSpecialistGuidCards(dir);
      expect(repaired.sort()).toEqual(['accurate-agent', 'quotation-agent']);
      expect((await getCcbAgent('quotation-agent'))?.guid_primary).toBe(true);
      expect((await getCcbAgent('accurate-agent'))?.guid_primary).toBe(true);
    });
  });

  it('repairOfficeAgentAgentTypeIds sets frontmatter name to agent id and preserves display_name', async () => {
    await withTempConfigDir(async (dir) => {
      await saveCcbAgent({
        id: 'word-creator',
        name: 'Word 文档助手',
        description: 'Word docs',
        model: null,
        permission_mode: null,
        recommended_prompts: [],
        mcp_allowlist: [],
        skills: { enabled: ['officecli-docx'], disabled: [] },
        enabled: true,
        source: 'bundled',
        delegatable: true,
        guid_primary: true,
      });

      const { repaired } = await repairOfficeAgentAgentTypeIds(dir);
      expect(repaired).toEqual(['word-creator']);

      const agent = await getCcbAgent('word-creator');
      expect(agent?.name).toBe('word-creator');
      expect(agent?.display_name).toBe('Word 文档助手');

      const md = readFileSync(join(dir, 'agents', 'word-creator.md'), 'utf8');
      expect(md).toMatch(/^---\nname: word-creator/m);
    });
  });
});
