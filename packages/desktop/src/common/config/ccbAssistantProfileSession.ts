/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Handoff file for CCB-Wanding ACP session/new when aioncore does not forward
 * acp_meta.ccbAssistantProfileId into _meta.
 */

import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeCcbAssistantProfileId } from './ccbAssistantProfiles';
import { resolveCcbClaudeConfigDir, stripBuiltinAssistantIdPrefix } from './ccbWandingRuntime';

export const CCB_NEXT_ASSISTANT_PROFILE_FILE = '.aionui-next-assistant-profile.json' as const;
const MAX_PENDING_AGE_MS = 60_000;

export type CcbNextAssistantProfilePending = {
  profile_id: string;
  staged_at: string;
};

export async function stageNextCcbAssistantProfile(profileId: string): Promise<void> {
  const configDir = resolveCcbClaudeConfigDir();
  const normalizedId = normalizeCcbAssistantProfileId(stripBuiltinAssistantIdPrefix(profileId));
  if (!configDir || !normalizedId) {
    return;
  }

  const payload: CcbNextAssistantProfilePending = {
    profile_id: normalizedId,
    staged_at: new Date().toISOString(),
  };
  await writeFile(join(configDir, CCB_NEXT_ASSISTANT_PROFILE_FILE), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export async function readNextCcbAssistantProfilePending(
  configDir = resolveCcbClaudeConfigDir()
): Promise<CcbNextAssistantProfilePending | null> {
  if (!configDir) {
    return null;
  }
  const filePath = join(configDir, CCB_NEXT_ASSISTANT_PROFILE_FILE);
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const raw = JSON.parse((await readFile(filePath, 'utf8')).replace(/^\uFEFF/, '')) as CcbNextAssistantProfilePending;
    if (typeof raw.profile_id !== 'string' || !raw.profile_id.trim()) {
      return null;
    }
    const stagedAt = Date.parse(raw.staged_at);
    if (!Number.isFinite(stagedAt) || Date.now() - stagedAt > MAX_PENDING_AGE_MS) {
      await rm(filePath, { force: true });
      return null;
    }
    return { profile_id: raw.profile_id.trim(), staged_at: raw.staged_at };
  } catch {
    return null;
  }
}

export async function clearNextCcbAssistantProfilePending(configDir = resolveCcbClaudeConfigDir()): Promise<void> {
  if (!configDir) {
    return;
  }
  await rm(join(configDir, CCB_NEXT_ASSISTANT_PROFILE_FILE), { force: true });
}
