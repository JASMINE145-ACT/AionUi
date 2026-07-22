/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * CCB-authority preset sessions: hand off profile id only. CCB resolves prompt,
 * CLAUDE.md, MCP, skills, model, and permission from assistants/<id>.json.
 */

import { ipcBridge } from '@/common';
import { isWebUiBrowserMode } from '@/common/adapter/httpBridge';
import { ccbModelService } from '@/common/adapter/ipcBridge';
import type { ICreateConversationParams } from '@/common/adapter/ipcBridge';
import type { TMessage } from '@/common/chat/chatLib';
import { stripBuiltinAssistantIdPrefix } from '@/common/config/ccbWandingRuntime';

const QUOTATION_AGENT_ID = 'quotation-agent';
const ACCURATE_AGENT_ID = 'accurate-agent';

export function resolveCcbProfileIdFromConversationExtra(
  extra: Record<string, unknown> | undefined
): string | undefined {
  if (!extra) return undefined;
  for (const key of ['ccb_assistant_profile_id', 'ccb_agent_id', 'preset_assistant_id', 'custom_agent_id'] as const) {
    const v = extra[key];
    if (typeof v === 'string' && v.trim()) return stripBuiltinAssistantIdPrefix(v.trim());
  }
  const acpMeta = extra.acp_meta;
  if (acpMeta && typeof acpMeta === 'object') {
    const nested = acpMeta as Record<string, unknown>;
    for (const key of [
      'ccbAgentId',
      'ccb_agent_id',
      'ccbAssistantProfileId',
      'ccb_assistant_profile_id',
      'preset_assistant_id',
    ] as const) {
      const v = nested[key];
      if (typeof v === 'string' && v.trim()) return stripBuiltinAssistantIdPrefix(v.trim());
    }
  }
  return undefined;
}

function specialistFromToolTitle(title: string): string | undefined {
  const t = title.trim().toLowerCase();
  if (t.includes('mcp__quotation__')) return QUOTATION_AGENT_ID;
  if (t.includes('mcp__accurate__')) return ACCURATE_AGENT_ID;
  return undefined;
}

function specialistFromMessage(message: TMessage): string | undefined {
  if (message.type === 'acp_tool_call') {
    const update = message.content?.update;
    if (!update) return undefined;
    const fromTitle = update.title ? specialistFromToolTitle(update.title) : undefined;
    if (fromTitle) return fromTitle;
    const raw = update.rawInput ?? (update as { raw_input?: Record<string, unknown> }).raw_input;
    if (update.title === 'Agent' && raw) {
      const sub =
        (typeof raw.subagent_type === 'string' && raw.subagent_type) ||
        (typeof raw.agent === 'string' && raw.agent) ||
        '';
      const id = sub.trim() ? stripBuiltinAssistantIdPrefix(sub.trim()) : '';
      if (id === QUOTATION_AGENT_ID || id === ACCURATE_AGENT_ID) return id;
    }
  }
  return undefined;
}

async function inferCcbSpecialistProfileFromConversation(conversation_id: string): Promise<string | undefined> {
  try {
    const page = await ipcBridge.database.getConversationMessages.invoke({
      conversation_id,
      page: 1,
      page_size: 80,
      order: 'desc',
      content_mode: 'compact',
    });
    for (const message of page?.items ?? []) {
      const specialist = specialistFromMessage(message);
      if (specialist) return specialist;
    }
  } catch (error) {
    console.warn('[inferCcbSpecialistProfileFromConversation] failed', {
      conversation_id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return undefined;
}

export async function stageCcbAssistantProfileForSession(profileId: string | undefined): Promise<void> {
  // WebUI: CCB profile staging IPC never resolves; create path already writes extras.
  if (isWebUiBrowserMode()) return;

  const id = profileId?.trim() ? stripBuiltinAssistantIdPrefix(profileId.trim()) : '';
  if (!id) return;

  try {
    await ipcBridge.ccbAssistantProfilesService.stageNextSessionProfile.invoke({ profile_id: id });
  } catch (error) {
    console.warn('[stageCcbAssistantProfileForSession] stageNextSessionProfile failed:', {
      profile_id: id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function stageCcbAssistantProfileFromConversation(conversation_id: string): Promise<void> {
  // WebUI has no CCB profile staging IPC — identity travels on conversation.extra instead.
  if (isWebUiBrowserMode()) return;

  const authorityActive = await ccbModelService.isAuthorityActive.invoke().catch(() => false);
  if (!authorityActive) return;

  const conversation = await ipcBridge.conversation.get
    .invoke({ id: conversation_id })
    .catch((): null => null);
  const extra = conversation?.extra as Record<string, unknown> | undefined;

  let profileId = resolveCcbProfileIdFromConversationExtra(extra);
  if (!profileId) {
    profileId = await inferCcbSpecialistProfileFromConversation(conversation_id);
  }

  if (!profileId) {
    console.info('[stageCcbAssistantProfileFromConversation] no_profile_to_stage', {
      conversation_id,
      has_extra: Boolean(extra),
    });
    return;
  }

  console.info('[stageCcbAssistantProfileFromConversation] staging', {
    conversation_id,
    profile_id: profileId,
    source: resolveCcbProfileIdFromConversationExtra(extra) ? 'extra' : 'history_inference',
  });
  await stageCcbAssistantProfileForSession(profileId);
}

export async function buildCcbPresetConversationExtra(
  profileId: string | undefined,
  ccbAuthorityActive: boolean
): Promise<Partial<ICreateConversationParams['extra']>> {
  if (!ccbAuthorityActive || !profileId?.trim()) {
    return {};
  }

  const id = stripBuiltinAssistantIdPrefix(profileId);
  // WebUI: skip profile IPC probe (never resolves); extras alone are enough for session create.
  if (!isWebUiBrowserMode()) {
    try {
      const profile = await ipcBridge.ccbAssistantProfilesService.getProfile.invoke({ id });
      if (!profile) {
        console.warn('[buildCcbPresetConversationExtra] profile_not_found', { profile_id: id });
      }
    } catch (error) {
      console.warn('[buildCcbPresetConversationExtra] profile_lookup_failed', {
        profile_id: id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ccb_assistant_profile_id: id,
    ccb_agent_id: id,
    preset_assistant_id: id,
    acp_meta: {
      ccbAssistantProfileId: id,
      ccbAgentId: id,
      preset_assistant_id: id,
    },
  };
}
