/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * CCB-authority preset sessions: hand off profile id only. CCB resolves prompt,
 * CLAUDE.md, MCP, skills, model, and permission from assistants/<id>.json.
 */

import { ipcBridge } from '@/common';
import { ccbModelService } from '@/common/adapter/ipcBridge';
import type { ICreateConversationParams } from '@/common/adapter/ipcBridge';
import { stripBuiltinAssistantIdPrefix } from '@/common/config/ccbWandingRuntime';

export async function stageCcbAssistantProfileForSession(profileId: string | undefined): Promise<void> {
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
  const authorityActive = await ccbModelService.isAuthorityActive.invoke().catch(() => false);
  if (!authorityActive) return;

  const conversation = await ipcBridge.conversation.get
    .invoke({ id: conversation_id })
    .catch((): null => null);
  const extra = conversation?.extra as Record<string, unknown> | undefined;
  if (!extra) return;

  const profileId =
    (typeof extra.ccb_assistant_profile_id === 'string' && extra.ccb_assistant_profile_id) ||
    (typeof extra.preset_assistant_id === 'string' && extra.preset_assistant_id) ||
    undefined;

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

  return {
    ccb_assistant_profile_id: id,
    ccb_agent_id: id,
    acp_meta: {
      ccbAssistantProfileId: id,
      ccbAgentId: id,
      preset_assistant_id: id,
    },
  };
}
