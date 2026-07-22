/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { isWebUiBrowserMode } from '@/common/adapter/httpBridge';
import { ccbAgentsService } from '@/common/adapter/ipcBridge';
import { assistantDetailFromCcbAgent } from '@/common/config/ccbAgentCatalog';
import { assistantDetailFromCcbProfile } from '@/common/config/ccbAssistantCatalog';
import { fetchWebUiCcbAgents } from '@/common/webui/ccbWebApi';
import type { AssistantDetail } from '@/common/types/agent/assistantTypes';

export async function fetchGuidAssistantDetail(
  id: string,
  options: { localeKey: string; ccbAuthorityActive: boolean },
): Promise<AssistantDetail | null> {
  if (options.ccbAuthorityActive) {
    // WebUI: no profile/getAgent IPC — resolve from HTTP agent list.
    if (isWebUiBrowserMode()) {
      const agents = await fetchWebUiCcbAgents().catch((): [] => []);
      const agent = agents.find((entry) => entry.id === id) ?? null;
      return agent ? assistantDetailFromCcbAgent(agent) : null;
    }
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
