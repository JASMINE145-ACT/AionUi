/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { CcbSkillInfo } from '@/common/config/ccbSkillsShared';
import type { IMcpServer } from '@/common/config/storage';
import {
  mapCcbSkillsToGuidCatalog,
  resolveCcbMcpAllowlistIds,
  resolveEnabledMcpServerIds,
  resolveSessionEffectiveMcpServerIds,
  resolveSessionEffectiveSkillNames,
} from '@/renderer/pages/guid/utils/guidCapabilitiesCatalog';

describe('guidCapabilitiesCatalog', () => {
  it('maps ready CCB skills into Guid catalog items', () => {
    const skills: CcbSkillInfo[] = [
      {
        name: 'officecli',
        description: 'Office CLI skill',
        location: 'C:\\skills\\officecli',
        is_custom: false,
        status: 'ready',
      },
      {
        name: 'broken-skill',
        description: 'Invalid',
        location: 'C:\\skills\\broken',
        is_custom: true,
        status: 'invalid',
      },
    ];

    expect(mapCcbSkillsToGuidCatalog(skills)).toEqual([
      {
        name: 'officecli',
        description: 'Office CLI skill',
        isAuto: false,
      },
    ]);
  });

  it('resolves enabled MCP server ids from catalog entries', () => {
    const servers: IMcpServer[] = [
      {
        id: 'ccb-mcp:quotation',
        name: 'quotation',
        enabled: true,
        transport: { type: 'stdio', command: 'node', args: ['q.js'] },
        created_at: 1,
        updated_at: 1,
        original_json: '{}',
      },
      {
        id: 'ccb-mcp:excel-mcp',
        name: 'excel-mcp',
        enabled: false,
        transport: { type: 'stdio', command: 'node', args: ['e.js'] },
        created_at: 1,
        updated_at: 1,
        original_json: '{}',
      },
    ];

    expect(resolveEnabledMcpServerIds(servers)).toEqual(['ccb-mcp:quotation']);
  });

  it('returns no session MCP when agent allowlist is empty (orchestrator)', () => {
    const servers: IMcpServer[] = [
      {
        id: 'ccb-mcp:quotation',
        name: 'quotation',
        enabled: true,
        transport: { type: 'stdio', command: 'node', args: ['q.js'] },
        created_at: 1,
        updated_at: 1,
        original_json: '{}',
      },
      {
        id: 'ccb-mcp:accurate',
        name: 'accurate',
        enabled: true,
        transport: { type: 'stdio', command: 'node', args: ['a.js'] },
        created_at: 1,
        updated_at: 1,
        original_json: '{}',
      },
    ];
    const enabled = resolveEnabledMcpServerIds(servers);
    expect(resolveSessionEffectiveMcpServerIds(servers, enabled, [])).toEqual([]);
  });

  it('filters session MCP to agent allowlist intersected with globally enabled', () => {
    const servers: IMcpServer[] = [
      {
        id: 'ccb-mcp:quotation',
        name: 'quotation',
        enabled: true,
        transport: { type: 'stdio', command: 'node', args: ['q.js'] },
        created_at: 1,
        updated_at: 1,
        original_json: '{}',
      },
      {
        id: 'ccb-mcp:accurate',
        name: 'accurate',
        enabled: false,
        transport: { type: 'stdio', command: 'node', args: ['a.js'] },
        created_at: 1,
        updated_at: 1,
        original_json: '{}',
      },
    ];
    const enabled = resolveEnabledMcpServerIds(servers);
    expect(resolveSessionEffectiveMcpServerIds(servers, enabled, ['quotation'])).toEqual([
      'ccb-mcp:quotation',
    ]);
  });

  it('returns no session skills when agent skills allowlist is empty', () => {
    expect(resolveSessionEffectiveSkillNames(['officecli-docx', 'cron'], [])).toEqual([]);
  });

  it('filters session skills to agent allowlist', () => {
    expect(resolveSessionEffectiveSkillNames(['officecli-docx', 'cron'], ['officecli-docx'])).toEqual([
      'officecli-docx',
    ]);
  });

  it('falls back to agent sidecar MCP allowlist when detail is empty', () => {
    expect(resolveCcbMcpAllowlistIds([], ['quotation', 'excel'])).toEqual([
      'ccb-mcp:quotation',
      'ccb-mcp:excel',
    ]);
    expect(resolveCcbMcpAllowlistIds(['ccb-mcp:accurate'], ['quotation'])).toEqual(['ccb-mcp:accurate']);
  });
});
