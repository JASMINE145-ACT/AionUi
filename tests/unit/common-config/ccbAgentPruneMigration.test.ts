/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { pruneBundledAgentsNotInKeepSet } from '@/common/config/ccbAgentMigration';
import { saveCcbAgent } from '@/common/config/ccbAgents';

const originalWandingConfigDir = process.env.CCB_WANDING_CONFIG_DIR;
const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;

function useIsolatedConfigDir(configDir: string): void {
  process.env.CCB_WANDING_CONFIG_DIR = configDir;
  process.env.CLAUDE_CONFIG_DIR = configDir;
}

function restoreConfigDirs(): void {
  if (originalWandingConfigDir === undefined) {
    delete process.env.CCB_WANDING_CONFIG_DIR;
  } else {
    process.env.CCB_WANDING_CONFIG_DIR = originalWandingConfigDir;
  }
  if (originalClaudeConfigDir === undefined) {
    delete process.env.CLAUDE_CONFIG_DIR;
  } else {
    process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
  }
}

function writeWandingInstallMarker(configDir: string): void {
  mkdirSync(configDir, { recursive: true });
  writeFileSync(join(configDir, 'settings.json'), '{}\n', 'utf8');
}

function agentInput(id: string, source: 'bundled' | 'user') {
  return {
    id,
    name: id,
    description: `${id} desc`,
    system_prompt: `You are ${id}.`,
    source,
    enabled: true,
    mcp_allowlist: [] as string[],
    skills: { enabled: [] as string[], disabled: [] as string[] },
  };
}

describe('pruneBundledAgentsNotInKeepSet', () => {
  afterEach(() => {
    restoreConfigDirs();
  });

  it('deletes bundled agents outside the WanD keep set but keeps user agents', async () => {
    const configDir = mkdtempSync(join(tmpdir(), 'ccb-wanding-prune-'));
    useIsolatedConfigDir(configDir);
    writeWandingInstallMarker(configDir);

    await saveCcbAgent(agentInput('cowork', 'bundled'));
    await saveCcbAgent(agentInput('word-creator', 'bundled'));
    await saveCcbAgent(agentInput('game-3d', 'bundled'));
    await saveCcbAgent(agentInput('my-custom', 'user'));

    const report = await pruneBundledAgentsNotInKeepSet(configDir);
    expect(report?.agents_deleted.sort()).toEqual(['cowork', 'game-3d']);
    expect(report?.agents_skipped.some((item) => item.id === 'word-creator' && item.reason === 'in_keep_set')).toBe(true);
    expect(report?.agents_skipped.some((item) => item.id === 'my-custom' && item.reason === 'not_bundled')).toBe(true);

    const { listCcbAgents } = await import('@/common/config/ccbAgents');
    const remaining = (await listCcbAgents()).map((agent) => agent.id).sort();
    expect(remaining).toEqual(['my-custom', 'word-creator']);
  });
});
