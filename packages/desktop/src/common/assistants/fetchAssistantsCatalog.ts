/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { assistants, ccbAgentsService, ccbModelService } from '@/common/adapter/ipcBridge';
import { assistantFromCcbAgent, filterGuidCatalogAgents } from '@/common/config/ccbAgentCatalog';
import type { Assistant } from '@/common/types/agent/assistantTypes';

export const ASSISTANTS_LIST_SWR_KEY = 'assistants.list' as const;

/** Preset assistant catalog — CCB agent files when authority active, else backend /api/assistants. */
export async function fetchAssistantsCatalog(): Promise<Assistant[]> {
  const ccbAuthorityActive = await ccbModelService.isAuthorityActive.invoke().catch(() => false);

  if (ccbAuthorityActive) {
    const ccbAgents = await ccbAgentsService.listAgents.invoke();
    return filterGuidCatalogAgents(ccbAgents)
      .map((agent, index) => assistantFromCcbAgent(agent, index))
      .sort((a, b) => {
        const aOrder = typeof a.sort_order === 'number' ? a.sort_order : Number.MAX_SAFE_INTEGER;
        const bOrder = typeof b.sort_order === 'number' ? b.sort_order : Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      });
  }

  return assistants.list.invoke();
}
