/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Handoff conversation_id for CCB hooks (SP2 knowledge continuity via CCB_CONVERSATION_ID).
 */

import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveCcbClaudeConfigDir } from './ccbWandingRuntime';

export const CCB_NEXT_CONVERSATION_ID_FILE = '.aionui-next-conversation-id.json' as const;
const MAX_PENDING_AGE_MS = 300_000;

export type CcbNextConversationIdPending = {
  conversation_id: string;
  staged_at: string;
};

export async function stageNextConversationId(conversation_id: string): Promise<void> {
  const configDir = resolveCcbClaudeConfigDir();
  const id = conversation_id.trim();
  if (!configDir || !id) {
    return;
  }

  const payload: CcbNextConversationIdPending = {
    conversation_id: id,
    staged_at: new Date().toISOString(),
  };
  await writeFile(join(configDir, CCB_NEXT_CONVERSATION_ID_FILE), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export async function readNextConversationIdPending(
  configDir = resolveCcbClaudeConfigDir(),
): Promise<CcbNextConversationIdPending | null> {
  if (!configDir) {
    return null;
  }
  const filePath = join(configDir, CCB_NEXT_CONVERSATION_ID_FILE);
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const raw = JSON.parse((await readFile(filePath, 'utf8')).replace(/^\uFEFF/, '')) as CcbNextConversationIdPending;
    if (typeof raw.conversation_id !== 'string' || !raw.conversation_id.trim()) {
      return null;
    }
    const stagedAt = Date.parse(raw.staged_at);
    if (!Number.isFinite(stagedAt) || Date.now() - stagedAt > MAX_PENDING_AGE_MS) {
      await rm(filePath, { force: true });
      return null;
    }
    return { conversation_id: raw.conversation_id.trim(), staged_at: raw.staged_at };
  } catch {
    return null;
  }
}

export async function clearNextConversationIdPending(configDir = resolveCcbClaudeConfigDir()): Promise<void> {
  if (!configDir) {
    return;
  }
  await rm(join(configDir, CCB_NEXT_CONVERSATION_ID_FILE), { force: true });
}
