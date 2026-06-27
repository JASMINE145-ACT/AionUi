/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ccbModelService, ccbMcpService } from '@/common/adapter/ipcBridge';
import { ccbMcpIdFromName } from '@/common/config/ccbAssistantCatalog';
import { ensureBackendMcpCatalog } from '@/renderer/hooks/mcp/catalog';
import type { CcbSkillInfo } from '@/common/config/ccbSkillsShared';
import type { IMcpServer } from '@/common/config/storage';

export type GuidSkillCatalogItem = {
  name: string;
  description: string;
  isAuto: boolean;
};

export type GuidCapabilitiesSource = 'aionui' | 'ccb';

export type GuidCapabilitiesCatalog = {
  source: GuidCapabilitiesSource;
  skills: GuidSkillCatalogItem[];
  mcpServers: IMcpServer[];
};

export function mapCcbSkillsToGuidCatalog(skills: CcbSkillInfo[]): GuidSkillCatalogItem[] {
  return skills
    .filter((skill) => skill.status !== 'invalid' && skill.status !== 'missing')
    .map((skill) => ({
      name: skill.name,
      description: skill.description,
      isAuto: false,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function loadCcbGuidSkillsCatalog(): Promise<GuidSkillCatalogItem[]> {
  await ipcBridge.ccbSkillsService.syncFromAionUi.invoke().catch((error) => {
    console.warn('[guidCapabilitiesCatalog] CCB skill sync from AionUI failed:', error);
  });
  const skills = await ipcBridge.ccbSkillsService.listSkills.invoke();
  return mapCcbSkillsToGuidCatalog(skills);
}

export async function loadAionUiGuidSkillsCatalog(): Promise<GuidSkillCatalogItem[]> {
  const [autoSkills, availableSkills] = await Promise.all([
    ipcBridge.fs.listBuiltinAutoSkills.invoke(),
    ipcBridge.fs.listAvailableSkills.invoke(),
  ]);
  const autoNames = new Set(autoSkills.map((skill) => skill.name));
  return [
    ...autoSkills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      isAuto: true,
    })),
    ...availableSkills
      .filter((skill) => !autoNames.has(skill.name))
      .map((skill) => ({
        name: skill.name,
        description: skill.description,
        isAuto: false,
      })),
  ];
}

export async function loadCcbGuidMcpCatalog(): Promise<IMcpServer[]> {
  return ccbMcpService.listServers.invoke({ test: false });
}

export async function loadAionUiGuidMcpCatalog(): Promise<IMcpServer[]> {
  const { allServers } = await ensureBackendMcpCatalog();
  return allServers;
}

/** Guid action-row catalog — CCB skills/MCP when authority active, else upstream aioncore corpus. */
export async function loadGuidCapabilitiesCatalog(): Promise<GuidCapabilitiesCatalog> {
  const ccbAuthorityActive = await ccbModelService.isAuthorityActive.invoke().catch(() => false);
  if (ccbAuthorityActive) {
    const [skills, mcpServers] = await Promise.all([loadCcbGuidSkillsCatalog(), loadCcbGuidMcpCatalog()]);
    return { source: 'ccb', skills, mcpServers };
  }
  const [skills, mcpServers] = await Promise.all([loadAionUiGuidSkillsCatalog(), loadAionUiGuidMcpCatalog()]);
  return { source: 'aionui', skills, mcpServers };
}

export function resolveEnabledMcpServerIds(servers: IMcpServer[]): string[] {
  return servers.filter((server) => server.enabled).map((server) => server.id);
}

/** Strip optional `ccb-mcp:` prefix from catalog ids / allowlist entries. */
export function normalizeMcpAllowlistName(name: string): string {
  return name.replace(/^ccb-mcp:/i, '').trim().toLowerCase();
}

/**
 * MCP ids the current CCB agent profile exposes to the model this session.
 * Mirrors `filterMcpConfigsForAssistantProfile`: empty allowlist → none in session.
 */
export function resolveSessionEffectiveMcpServerIds(
  servers: IMcpServer[],
  globallyEnabledIds: string[],
  mcpAllowlist: string[],
): string[] {
  if (mcpAllowlist.length === 0) return [];
  const allowed = new Set(mcpAllowlist.map(normalizeMcpAllowlistName));
  return globallyEnabledIds.filter((id) => {
    const server = servers.find((entry) => entry.id === id);
    const name = normalizeMcpAllowlistName(server?.name ?? id);
    return allowed.has(name);
  });
}

/**
 * Skill names active for the current agent profile this session.
 * Empty allowlist → none (matches CCB assistant profile skill filter).
 */
export function resolveSessionEffectiveSkillNames(
  catalogSkillNames: string[],
  skillsAllowlist: string[],
): string[] {
  if (skillsAllowlist.length === 0) return [];
  const allowed = new Set(skillsAllowlist.map((name) => name.trim().toLowerCase()));
  return catalogSkillNames.filter((name) => allowed.has(name.trim().toLowerCase()));
}

/** Prefer resolved assistant detail; fall back to raw CCB agent sidecar allowlist. */
export function resolveCcbMcpAllowlistIds(detailMcpIds: string[], agentMcpAllowlist?: string[]): string[] {
  if (detailMcpIds.length > 0) return detailMcpIds;
  return (agentMcpAllowlist ?? []).map(ccbMcpIdFromName);
}
