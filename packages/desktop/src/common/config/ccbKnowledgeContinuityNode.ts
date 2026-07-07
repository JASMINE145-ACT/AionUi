/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Main-process writer for conversation-scoped knowledge continuity (SP2 hooks).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { KnowledgeContinuityState } from './ccbContinuitySnapshotShared';

function safeConversationId(conversation_id: string): string {
  const cleaned = conversation_id.trim().replace(/[^A-Za-z0-9._-]+/g, '_');
  return cleaned || 'unknown';
}

function resolveKnowledgeContinuityDir(): string {
  const base = process.env.LOCALAPPDATA?.trim();
  if (base) {
    return join(base, 'knowledge-continuity');
  }
  return join(process.env.USERPROFILE ?? process.env.HOME ?? '.', '.claude', 'logs', 'knowledge-continuity');
}

export function writeConversationKnowledgeContinuityState(
  conversation_id: string,
  state: KnowledgeContinuityState,
  session_id?: string,
): void {
  const id = conversation_id.trim();
  if (!id) {
    return;
  }
  const dir = resolveKnowledgeContinuityDir();
  mkdirSync(dir, { recursive: true });
  const payload = {
    kb_content_hash: state.kb_content_hash,
    read_at_generation: state.read_at_generation,
    match_count_since_read: state.match_count_since_read,
    invalidated: state.invalidated,
    invalidated_reason: state.invalidated_reason ?? null,
  };
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  writeFileSync(join(dir, `${safeConversationId(id)}.json`), body, 'utf8');

  const sessionKey = session_id?.trim();
  if (sessionKey && !state.invalidated) {
    const sessionDir = resolveKnowledgeEffectivenessDir();
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(join(sessionDir, `${safeConversationId(sessionKey)}.json`), body, 'utf8');
  }
}

function resolveKnowledgeEffectivenessDir(): string {
  const base = process.env.LOCALAPPDATA?.trim();
  if (base) {
    return join(base, 'knowledge-effectiveness');
  }
  return join(process.env.USERPROFILE ?? process.env.HOME ?? '.', '.claude', 'logs', 'knowledge-effectiveness');
}
