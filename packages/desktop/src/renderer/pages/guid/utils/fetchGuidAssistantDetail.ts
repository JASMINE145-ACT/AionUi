/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ccbAgentsService } from '@/common/adapter/ipcBridge';
import { assistantDetailFromCcbAgent } from '@/common/config/ccbAgentCatalog';
import { assistantDetailFromCcbProfile } from '@/common/config/ccbAssistantCatalog';
import type { AssistantDetail } from '@/common/types/agent/assistantTypes';

export async function fetchGuidAssistantDetail(
  id: string,
  options: { localeKey: string; ccbAuthorityActive: boolean },
): Promise<AssistantDetail | null> {
  if (options.ccbAuthorityActive) {
    const profile = await ipcBridge.ccbAssistantProfilesService.getProfile.invoke({ id }).catch((): null => null);
    if (profile) {
      return assistantDetailFromCcbProfile(profile);
    }
    const agent = await ccbAgentsService.getAgent.invoke({ id }).catch((): null => null);
    if (agent) {
      return assistantDetailFromCcbAgent(agent);
    }
    return null;
  }

  return ipcBridge.assistants.get
    .invoke({ id, locale: options.localeKey })
    .catch((): null => null);
}
