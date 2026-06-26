/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * CCB-authority preset sessions: hand off profile id only. CCB resolves prompt,
 * CLAUDE.md, MCP, skills, model, and permission from assistants/<id>.json.
 */

import { ipcBridge } from '@/common';
import type { ICreateConversationParams } from '@/common/adapter/ipcBridge';
import { stripBuiltinAssistantIdPrefix } from '@/common/config/ccbWandingRuntime';

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
