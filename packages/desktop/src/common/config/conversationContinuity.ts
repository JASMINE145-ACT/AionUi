/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Conversation continuity — detect upgrade/config staleness and bind session runtime.
 */

import { ipcBridge } from '@/common';
import { ccbModelService } from '@/common/adapter/ipcBridge';
import {
  CONTINUITY_EXTRA_KEYS,
  type CcbContinuitySnapshot,
} from '@/common/config/ccbContinuitySnapshotShared';
import { seedCcbSessionPreferredMode } from '@/common/config/ccbSessionPreferredModeStore';
import { CCB_PRESET_AGENT_BACKEND } from '@/common/config/ccbWandingRuntime';
import {
  resolveKnowledgeContinuityOnRefresh,
  shouldDeferConversationRefresh,
} from '@/common/config/knowledgeContinuity';
import { resolveCcbProfileIdFromConversationExtra } from '@/common/utils/ccbPresetConversationExtra';
import type { TChatConversation } from '@/common/config/storage';

export type ConversationContinuityContext = {
  conversation_id: string;
  snapshot: CcbContinuitySnapshot;
  extra: Record<string, unknown>;
  session_mode?: string;
  last_bound_config_generation: number;
  last_bound_app_version: string;
  effective_installed_version: string;
};

export type PrepareConversationContinuityResult = {
  ccbAuthority: boolean;
  /** When true, warmup must run with force (stale binding or caller force). */
  forceWarmup: boolean;
  needsRefresh: boolean;
  /** Stale but refresh deferred until turn/permission completes (C6). */
  refreshDeferred?: boolean;
  snapshot?: CcbContinuitySnapshot;
};

export type PersistConversationContinuityResult = {
  userNotice?: string;
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

/** CCB-Wanding continuity applies to claude ACP sessions (Guid, orchestrator, presets), not legacy gemini/aionrs. */
export function isCcbWandingConversation(
  conversation: Pick<TChatConversation, 'type' | 'extra'> | null | undefined,
): boolean {
  if (!conversation || conversation.type !== 'acp') {
    return false;
  }
  const extra = (conversation.extra ?? {}) as Record<string, unknown>;
  if (extra.is_health_check === true) {
    return false;
  }

  const backend = typeof extra.backend === 'string' ? extra.backend.trim() : '';
  if (backend && backend !== CCB_PRESET_AGENT_BACKEND) {
    return false;
  }

  if (
    resolveCcbProfileIdFromConversationExtra(extra) ||
    extra.preset_assistant_id ||
    extra.ccb_agent_id ||
    extra.ccb_assistant_profile_id
  ) {
    return true;
  }

  return backend === CCB_PRESET_AGENT_BACKEND;
}

export function resolveEffectiveInstalledVersion(snapshot: CcbContinuitySnapshot): string {
  return snapshot.installed_version?.trim() || snapshot.app_version.trim() || 'unknown';
}

export function needsConversationRefresh(ctx: ConversationContinuityContext): boolean {
  if (ctx.snapshot.ship_config_generation > ctx.last_bound_config_generation) {
    return true;
  }
  if (
    ctx.effective_installed_version &&
    ctx.effective_installed_version !== 'unknown' &&
    ctx.effective_installed_version !== ctx.last_bound_app_version
  ) {
    return true;
  }
  return false;
}

export async function resolveConversationContinuityContext(
  conversation_id: string,
  snapshot: CcbContinuitySnapshot,
  conversationExtra?: Record<string, unknown>,
): Promise<ConversationContinuityContext> {
  const extra =
    conversationExtra ??
    ((await ipcBridge.conversation.get
      .invoke({ id: conversation_id })
      .catch((): null => null)
    )?.extra ?? {}) as Record<string, unknown>;
  const session_mode =
    typeof extra.session_mode === 'string' && extra.session_mode.trim()
      ? extra.session_mode.trim()
      : undefined;

  return {
    conversation_id,
    snapshot,
    extra,
    session_mode,
    last_bound_config_generation: readExtraNumber(
      extra,
      CONTINUITY_EXTRA_KEYS.last_bound_config_generation,
    ),
    last_bound_app_version: readExtraString(extra, CONTINUITY_EXTRA_KEYS.last_bound_app_version),
    effective_installed_version: resolveEffectiveInstalledVersion(snapshot),
  };
}

export async function prepareConversationContinuity(
  conversation_id: string,
  options: { force?: boolean } = {},
): Promise<PrepareConversationContinuityResult> {
  const authorityActive = await ccbModelService.isAuthorityActive.invoke().catch(() => false);
  if (!authorityActive) {
    return {
      ccbAuthority: false,
      forceWarmup: Boolean(options.force),
      needsRefresh: false,
    };
  }

  const conversation = await ipcBridge.conversation.get
    .invoke({ id: conversation_id })
    .catch((error: unknown): never => {
      throw new Error(
        `无法加载会话信息：${error instanceof Error ? error.message : String(error)}`,
      );
    });

  if (!isCcbWandingConversation(conversation)) {
    return {
      ccbAuthority: false,
      forceWarmup: Boolean(options.force),
      needsRefresh: false,
    };
  }

  const snapshot = await ccbModelService.getContinuitySnapshot.invoke().catch((): null => null);
  if (!snapshot) {
    throw new Error(
      '无法读取当前安装版本信息，请完全退出并重新打开 AionUI 后再试。',
    );
  }

  const ctx = await resolveConversationContinuityContext(
    conversation_id,
    snapshot,
    (conversation.extra ?? {}) as Record<string, unknown>,
  );
  if (ctx.session_mode) {
    seedCcbSessionPreferredMode(conversation_id, ctx.session_mode);
  }

  const stale = needsConversationRefresh(ctx);
  const deferRefresh = stale && shouldDeferConversationRefresh(conversation);
  const forceWarmup = Boolean(options.force) || (stale && !deferRefresh);

  if (stale) {
    console.info('[conversationContinuity] needs_refresh', {
      conversation_id,
      ship_generation: ctx.snapshot.ship_config_generation,
      last_bound_generation: ctx.last_bound_config_generation,
      installed_version: ctx.effective_installed_version,
      last_bound_version: ctx.last_bound_app_version,
      deferred: deferRefresh,
    });
  }

  return {
    ccbAuthority: true,
    forceWarmup,
    needsRefresh: stale,
    refreshDeferred: deferRefresh,
    snapshot,
  };
}

export async function persistConversationContinuityBinding(
  conversation_id: string,
  snapshot: CcbContinuitySnapshot | undefined,
  conversationExtra?: Record<string, unknown>,
  session_id?: string,
): Promise<PersistConversationContinuityResult> {
  if (!snapshot) return {};

  const effectiveVersion = resolveEffectiveInstalledVersion(snapshot);
  const extra = conversationExtra ?? {};
  const knowledge = resolveKnowledgeContinuityOnRefresh(extra, snapshot);

  try {
    await ipcBridge.conversation.update.invoke({
      id: conversation_id,
      merge_extra: true,
      updates: {
        extra: {
          [CONTINUITY_EXTRA_KEYS.last_bound_config_generation]: snapshot.ship_config_generation,
          [CONTINUITY_EXTRA_KEYS.last_bound_app_version]: effectiveVersion,
          ...knowledge.extraUpdates,
        },
      },
    });
    if (!knowledge.skipDiskSync && knowledge.diskState) {
      await ccbModelService.syncKnowledgeContinuity.invoke({
        conversation_id,
        state: knowledge.diskState,
        session_id,
      }).catch((error: unknown) => {
        throw new Error(error instanceof Error ? error.message : String(error));
      });
    }
    console.info('[conversationContinuity] bound', {
      conversation_id,
      generation: snapshot.ship_config_generation,
      version: effectiveVersion,
      knowledge_inherit: knowledge.inherit,
      knowledge_invalidate: knowledge.invalidate,
    });
    return { userNotice: knowledge.userNotice };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[conversationContinuity] persist_binding_failed', {
      conversation_id,
      error: message,
    });
    throw new Error(`会话版本绑定失败：${message}`);
  }
}
