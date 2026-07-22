/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { assistants, ccbAgentsService, ccbModelService } from '@/common/adapter/ipcBridge';
import { isWebUiBrowserMode } from '@/common/adapter/httpBridge';
import { getOrgBearerToken, isOrgServerConfigured, orgRawFetch } from '@/common/adapter/orgHttpBridge';
import { fetchWebUiCcbAgents, fetchWebUiCcbAuthority } from '@/common/webui/ccbWebApi';
import { assistantFromCcbAgent, filterGuidCatalogAgents } from '@/common/config/ccbAgentCatalog';
import type { Assistant } from '@/common/types/agent/assistantTypes';

export const ASSISTANTS_LIST_SWR_KEY = 'assistants.list' as const;

/** Probe org draft GET — 200 ⇒ price_admin; 403 ⇒ hide admin-only Guid cards. */
export async function resolveIsOrgPriceAdmin(): Promise<boolean> {
  if (!isOrgServerConfigured()) return false;
  const token = getOrgBearerToken();
  if (!token) return false;
  try {
    const response = await orgRawFetch('GET', '/api/price-library/draft', undefined, {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Preset assistant catalog — CCB agent files when authority active, else backend /api/assistants. */
export async function fetchAssistantsCatalog(): Promise<Assistant[]> {
  // WebUI: platform invoke never rejects; prefer same-origin HTTP (no hang on Electron CCB providers).
  const ccbAuthorityActive = isWebUiBrowserMode()
    ? await fetchWebUiCcbAuthority().catch(() => false)
    : await ccbModelService.isAuthorityActive.invoke().catch(() => false);

  if (ccbAuthorityActive) {
    const isPriceAdminPromise = resolveIsOrgPriceAdmin().catch(() => false);
    let ccbAgents;
    if (isWebUiBrowserMode()) {
      ccbAgents = await fetchWebUiCcbAgents();
    } else {
      try {
        ccbAgents = await ccbAgentsService.listAgents.invoke();
      } catch {
        throw new Error('Failed to load CCB agents catalog');
      }
    }

    const isPriceAdmin = await isPriceAdminPromise;
    return filterGuidCatalogAgents(ccbAgents, { isPriceAdmin })
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
