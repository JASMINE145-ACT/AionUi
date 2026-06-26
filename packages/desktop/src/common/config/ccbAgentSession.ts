/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Handoff file for CCB-Wanding ACP session/new when aioncore does not forward
 * acp_meta.ccbAgentId / ccbAssistantProfileId into _meta.
 */

import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeAgentId } from './ccbAgentIdShared';
import { CCB_NEXT_ASSISTANT_PROFILE_FILE } from './ccbAssistantProfileSession';
import { resolveCcbClaudeConfigDir, stripBuiltinAssistantIdPrefix } from './ccbWandingRuntime';

export type CcbNextAgentPending = {
  profile_id: string;
  staged_at: string;
};

export async function stageNextSessionAgent(agentId: string): Promise<void> {
  const configDir = resolveCcbClaudeConfigDir();
  const normalizedId = normalizeAgentId(stripBuiltinAssistantIdPrefix(agentId));
  if (!configDir || !normalizedId) {
    return;
  }

  const payload: CcbNextAgentPending = {
    profile_id: normalizedId,
    staged_at: new Date().toISOString(),
  };
  await writeFile(join(configDir, CCB_NEXT_ASSISTANT_PROFILE_FILE), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export async function readNextSessionAgentPending(
  configDir = resolveCcbClaudeConfigDir()
): Promise<CcbNextAgentPending | null> {
  if (!configDir) {
    return null;
  }
  const filePath = join(configDir, CCB_NEXT_ASSISTANT_PROFILE_FILE);
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const raw = JSON.parse((await readFile(filePath, 'utf8')).replace(/^\uFEFF/, '')) as CcbNextAgentPending;
    if (typeof raw.profile_id !== 'string' || !raw.profile_id.trim()) {
      return null;
    }
    return { profile_id: raw.profile_id.trim(), staged_at: raw.staged_at };
  } catch {
    return null;
  }
}

export async function clearNextSessionAgentPending(configDir = resolveCcbClaudeConfigDir()): Promise<void> {
  if (!configDir) {
    return;
  }
  await rm(join(configDir, CCB_NEXT_ASSISTANT_PROFILE_FILE), { force: true });
}
