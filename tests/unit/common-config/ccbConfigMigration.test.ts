/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { IMcpServer } from '@/common/config/storage';
import {
  mergeMcpIntoCcbSettings,
  mcpServerToSettingsEntry,
  normalizeMcpServerName,
  safeSkillDirectoryName,
  stripAionUiRuntimeOverridesForCcb,
  stripCcbConversationExtra,
} from '@/common/config/ccbConfigMigrationShared';
import { exportAionUiRuntimeConfigToCcb } from '@/common/config/ccbConfigMigration';
import { isCcbWandingAgent, resolveCcbClaudeConfigDir } from '@/common/config/ccbWandingRuntime';

describe('ccbWandingRuntime', () => {
  it('detects CCB-Wanding agents by id, cli_path, or name', () => {
    expect(isCcbWandingAgent({ id: 'ccb-wanding-route-b', name: 'CCB-Wanding' })).toBe(true);
    expect(isCcbWandingAgent({ cli_path: 'D:\\CCB-Wanding\\dist\\cli.js' })).toBe(true);
    expect(isCcbWandingAgent({ backend: 'claude-code', name: 'Vanilla Claude' })).toBe(false);
  });

  it('resolves Windows CCB config dir', () => {
    const dir = resolveCcbClaudeConfigDir();
    expect(dir?.toLowerCase()).toContain('ccb-wanding');
  });
});

describe('ccbConfigMigration helpers', () => {
  it('converts stdio MCP server to settings.json entry', () => {
    const server: IMcpServer = {
      id: '1',
      name: 'exa',
      enabled: true,
      transport: { type: 'stdio', command: 'node', args: ['server.js'] },
      created_at: 1,
      updated_at: 1,
      original_json: '{}',
    };
    expect(mcpServerToSettingsEntry(server)).toEqual({
      type: 'stdio',
      command: 'node',
      args: ['server.js'],
    });
  });

  it('merges importable MCP without overwriting CCB reserved names', () => {
    const servers: IMcpServer[] = [
      {
        id: 'q',
        name: 'quotation',
        enabled: true,
        transport: { type: 'stdio', command: 'noop' },
        created_at: 1,
        updated_at: 1,
        original_json: '{}',
      },
      {
        id: 'e',
        name: 'exa',
        enabled: true,
        transport: { type: 'http', url: 'https://mcp.exa.ai/mcp' },
        created_at: 1,
        updated_at: 1,
        original_json: '{}',
      },
    ];

    const result = mergeMcpIntoCcbSettings(
      { mcpServers: { quotation: { command: 'keep-me' } } },
      servers
    );

    expect(result.imported).toEqual(['exa']);
    expect(result.skippedReserved).toEqual(['quotation']);
    expect(result.settings.mcpServers?.quotation).toEqual({ command: 'keep-me' });
    expect(result.settings.mcpServers?.exa).toMatchObject({ type: 'http', url: 'https://mcp.exa.ai/mcp' });
  });

  it('treats reserved and existing MCP names case-insensitively', () => {
    const servers: IMcpServer[] = [
      {
        id: 'q',
        name: 'Quotation',
        enabled: true,
        transport: { type: 'stdio', command: 'noop' },
        created_at: 1,
        updated_at: 1,
        original_json: '{}',
      },
      {
        id: 'e',
        name: 'EXA',
        enabled: true,
        transport: { type: 'http', url: 'https://duplicate.example/mcp' },
        created_at: 1,
        updated_at: 1,
        original_json: '{}',
      },
    ];

    const result = mergeMcpIntoCcbSettings({ mcpServers: { exa: { url: 'keep-me' } } }, servers);

    expect(result.imported).toEqual([]);
    expect(result.skippedReserved).toEqual(['Quotation']);
    expect(result.skippedExisting).toEqual(['EXA']);
    expect(result.settings.mcpServers?.exa).toEqual({ url: 'keep-me' });
  });

  it('normalizes MCP names and sanitizes skill directory names', () => {
    expect(normalizeMcpServerName(' Quotation ')).toBe('quotation');
    expect(safeSkillDirectoryName('../bad:name*')).toBe('..-bad-name-');
    expect(safeSkillDirectoryName('...')).toBeNull();
  });

  it('exports settings with backup, report, reserved MCP protection, and sanitized skills', async () => {
    const configDir = await mkdtemp(join(tmpdir(), 'ccb-migration-'));
    const skillSource = await mkdtemp(join(tmpdir(), 'aionui-skill-'));
    await writeFile(join(configDir, 'settings.json'), JSON.stringify({ mcpServers: { quotation: { command: 'keep' } } }));
    await writeFile(join(skillSource, 'SKILL.md'), '# Skill');

    const report = await exportAionUiRuntimeConfigToCcb(
      configDir,
      [
        {
          id: 'q',
          name: 'Quotation',
          enabled: true,
          transport: { type: 'stdio', command: 'noop' },
          created_at: 1,
          updated_at: 1,
          original_json: '{}',
        },
        {
          id: 'exa',
          name: 'exa',
          enabled: true,
          transport: { type: 'http', url: 'https://mcp.exa.ai/mcp' },
          created_at: 1,
          updated_at: 1,
          original_json: '{}',
        },
      ],
      [{ name: 'bad/name', source_path: skillSource }]
    );

    const settings = JSON.parse(await readFile(join(configDir, 'settings.json'), 'utf8')) as {
      mcpServers: Record<string, unknown>;
    };
    const persistedReport = JSON.parse(await readFile(join(configDir, 'aionui-migration-report.json'), 'utf8')) as {
      mcp_imported: string[];
      mcp_skipped_reserved: string[];
      skills_copied: string[];
    };

    expect(report.backup_settings_path).toBeTruthy();
    expect(existsSync(report.backup_settings_path!)).toBe(true);
    expect(settings.mcpServers.quotation).toEqual({ command: 'keep' });
    expect(settings.mcpServers.exa).toMatchObject({ type: 'http', url: 'https://mcp.exa.ai/mcp' });
    expect(persistedReport.mcp_imported).toEqual(['exa']);
    expect(persistedReport.mcp_skipped_reserved).toEqual(['Quotation']);
    expect(persistedReport.skills_copied).toEqual(['bad/name']);
    expect(existsSync(join(configDir, 'skills', 'bad-name', 'SKILL.md'))).toBe(true);
  });

  it('strips AionUI runtime overrides for CCB sessions', () => {
    expect(
      stripAionUiRuntimeOverridesForCcb(
        {
          model: 'minimax-m3',
          permission: 'default',
          skill_ids: ['foo'],
          disabled_builtin_skill_ids: ['bar'],
          mcp_ids: ['mcp-1'],
        },
        true
      )
    ).toEqual({
      permission: 'default',
    });
  });

  it('strips conversation MCP/skills extra for CCB sessions', () => {
    expect(
      stripCcbConversationExtra(
        {
          selected_mcp_server_ids: ['a'],
          selected_session_mcp_servers: [{ id: 'b' }],
          skills: ['skill-a'],
        },
        true
      )
    ).toEqual({});
  });

  it('strips preset_context and preset_rules for CCB sessions', () => {
    expect(
      stripCcbConversationExtra(
        {
          preset_context: 'legacy prompt',
          preset_rules: 'legacy rules',
          acp_meta: {
            ccbAssistantProfileId: 'word-creator',
            preset_context: 'nested prompt',
          },
        },
        true
      )
    ).toEqual({
      acp_meta: {
        ccbAssistantProfileId: 'word-creator',
      },
    });
  });

  it('preserves default_files when stripping CCB conversation extra', () => {
    expect(
      stripCcbConversationExtra(
        {
          default_files: ['a.txt'],
          selected_mcp_server_ids: ['a'],
        },
        true
      )
    ).toEqual({ default_files: ['a.txt'] });
  });
});
