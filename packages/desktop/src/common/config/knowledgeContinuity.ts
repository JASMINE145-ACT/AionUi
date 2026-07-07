/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * SP2 knowledge effectiveness inherit on conversation soft refresh (ADR 2026-07-06).
 */

import {
  KNOWLEDGE_EXTRA_KEYS,
  type CcbContinuitySnapshot,
  type KnowledgeContinuityState,
} from '@/common/config/ccbContinuitySnapshotShared';
import type { TChatConversation } from '@/common/config/storage';

export type KnowledgeContinuityRefreshDecision = {
  inherit: boolean;
  invalidate: boolean;
  /** When true, do not write conversation/session knowledge files (no prior Read proof). */
  skipDiskSync: boolean;
  userNotice?: string;
  extraUpdates: Record<string, unknown>;
  diskState?: KnowledgeContinuityState;
};

function readExtraNumber(extra: Record<string, unknown>, key: string): number {
  const raw = extra[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.floor(raw);
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }
  return 0;
}

function readExtraString(extra: Record<string, unknown>, key: string): string {
  const raw = extra[key];
  return typeof raw === 'string' ? raw.trim() : '';
}

export function readKnowledgeContinuityFromExtra(
  extra: Record<string, unknown>,
): KnowledgeContinuityState | null {
  const kbHash = readExtraString(extra, KNOWLEDGE_EXTRA_KEYS.kb_content_hash);
  if (!kbHash) {
    return null;
  }
  return {
    kb_content_hash: kbHash,
    read_at_generation: readExtraNumber(extra, KNOWLEDGE_EXTRA_KEYS.read_at_generation),
    match_count_since_read: readExtraNumber(extra, KNOWLEDGE_EXTRA_KEYS.match_count_since_read),
    invalidated: extra[KNOWLEDGE_EXTRA_KEYS.invalidated] === true,
    invalidated_reason: readExtraString(extra, KNOWLEDGE_EXTRA_KEYS.invalidated_reason) || null,
  };
}

/** C6 — defer soft refresh while agent turn or permission is in flight. */
export function shouldDeferConversationRefresh(
  conversation: Pick<TChatConversation, 'runtime'> | null | undefined,
): boolean {
  const runtime = conversation?.runtime;
  if (!runtime) {
    return false;
  }
  if (runtime.is_processing) {
    return true;
  }
  if (runtime.state === 'waiting_confirmation') {
    return true;
  }
  if ((runtime.pending_confirmations ?? 0) > 0) {
    return true;
  }
  return false;
}

export function resolveKnowledgeContinuityOnRefresh(
  extra: Record<string, unknown>,
  snapshot: CcbContinuitySnapshot,
): KnowledgeContinuityRefreshDecision {
  const currentHash = snapshot.kb_content_hash.trim();
  const stored = readKnowledgeContinuityFromExtra(extra);
  const storedHash = stored?.kb_content_hash.trim() ?? '';

  const hashUnchanged = Boolean(currentHash && storedHash && currentHash === storedHash);
  const hadPriorRead = Boolean(stored && !stored.invalidated && storedHash);

  if (hadPriorRead && hashUnchanged) {
    const diskState: KnowledgeContinuityState = {
      kb_content_hash: currentHash,
      read_at_generation: snapshot.ship_config_generation,
      match_count_since_read: stored?.match_count_since_read ?? 0,
      invalidated: false,
      invalidated_reason: null,
    };
    return {
      inherit: true,
      invalidate: false,
      skipDiskSync: false,
      extraUpdates: {
        [KNOWLEDGE_EXTRA_KEYS.kb_content_hash]: diskState.kb_content_hash,
        [KNOWLEDGE_EXTRA_KEYS.read_at_generation]: diskState.read_at_generation,
        [KNOWLEDGE_EXTRA_KEYS.match_count_since_read]: diskState.match_count_since_read,
        [KNOWLEDGE_EXTRA_KEYS.invalidated]: false,
        [KNOWLEDGE_EXTRA_KEYS.invalidated_reason]: '',
      },
      diskState,
    };
  }

  if (hadPriorRead && storedHash && currentHash && storedHash !== currentHash) {
    const diskState: KnowledgeContinuityState = {
      kb_content_hash: currentHash,
      read_at_generation: snapshot.ship_config_generation,
      match_count_since_read: 0,
      invalidated: true,
      invalidated_reason: 'kb_hash_changed',
    };
    return {
      inherit: false,
      invalidate: true,
      skipDiskSync: false,
      userNotice: '业务知识库已更新，已重新加载',
      extraUpdates: {
        [KNOWLEDGE_EXTRA_KEYS.kb_content_hash]: diskState.kb_content_hash,
        [KNOWLEDGE_EXTRA_KEYS.read_at_generation]: diskState.read_at_generation,
        [KNOWLEDGE_EXTRA_KEYS.match_count_since_read]: 0,
        [KNOWLEDGE_EXTRA_KEYS.invalidated]: true,
        [KNOWLEDGE_EXTRA_KEYS.invalidated_reason]: 'kb_hash_changed',
      },
      diskState,
    };
  }

  return {
    inherit: false,
    invalidate: false,
    skipDiskSync: true,
    extraUpdates: {},
  };
}
