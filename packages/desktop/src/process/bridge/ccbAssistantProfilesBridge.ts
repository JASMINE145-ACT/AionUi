/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import {
  ccbAgentInputFromProfile,
  ccbAssistantProfileFromAgent,
} from '@/common/config/ccbAgentCatalog';
import {
  deleteCcbAgent,
  getCcbAgent,
  listCcbAgents,
  saveCcbAgent,
} from '@/common/config/ccbAgents';
import {
  deleteCcbAssistantProfile,
  getCcbAssistantProfile,
  listCcbAssistantProfiles,
  normalizeCcbAssistantProfile,
  saveCcbAssistantProfile,
  type CcbAssistantProfile,
  type CcbAssistantProfileInput,
} from '@/common/config/ccbAssistantProfiles';
import { stageNextSessionAgent } from '@/common/config/ccbAgentSession';

async function listProfilesWithAgentDelegation(): Promise<CcbAssistantProfile[]> {
  const agents = await listCcbAgents();
  if (agents.length === 0) {
    return listCcbAssistantProfiles();
  }

  const agentIds = new Set(agents.map((agent) => agent.id));
  const legacyProfiles = await listCcbAssistantProfiles();
  const fromAgents = agents.map(ccbAssistantProfileFromAgent);
  const orphanProfiles = legacyProfiles.filter((profile) => !agentIds.has(profile.id));
  return [...fromAgents, ...orphanProfiles].sort((a, b) => a.name.localeCompare(b.name));
}

async function getProfileWithAgentDelegation(id: string): Promise<CcbAssistantProfile | null> {
  const agent = await getCcbAgent(id);
  if (agent) {
    return ccbAssistantProfileFromAgent(agent);
  }
  return getCcbAssistantProfile(id);
}

async function saveProfileWithAgentDelegation(profile: CcbAssistantProfileInput): Promise<CcbAssistantProfile> {
  const normalized = normalizeCcbAssistantProfile(profile);
  if (!normalized) {
    return saveCcbAssistantProfile(profile);
  }

  try {
    const saved = await saveCcbAgent(ccbAgentInputFromProfile(normalized));
    return ccbAssistantProfileFromAgent(saved);
  } catch {
    return saveCcbAssistantProfile(profile);
  }
}

async function deleteProfileWithAgentDelegation(id: string): Promise<void> {
  const existingAgent = await getCcbAgent(id);
  if (existingAgent) {
    await deleteCcbAgent(id);
    return;
  }
  await deleteCcbAssistantProfile(id);
}

export function initCcbAssistantProfilesBridge(): void {
  ipcBridge.ccbAssistantProfilesService.listProfiles.provider(async () => listProfilesWithAgentDelegation());
  ipcBridge.ccbAssistantProfilesService.getProfile.provider(async ({ id }: { id: string }) =>
    getProfileWithAgentDelegation(id)
  );
  ipcBridge.ccbAssistantProfilesService.saveProfile.provider(async (profile: CcbAssistantProfileInput) =>
    saveProfileWithAgentDelegation(profile)
  );
  ipcBridge.ccbAssistantProfilesService.deleteProfile.provider(async ({ id }: { id: string }) =>
    deleteProfileWithAgentDelegation(id)
  );
  ipcBridge.ccbAssistantProfilesService.stageNextSessionProfile.provider(async ({ profile_id }: { profile_id: string }) => {
    await stageNextSessionAgent(profile_id);
  });
}
