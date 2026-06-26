/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Seed AionUI builtin assistant templates into CCB-Wanding assistant profiles.
 */

import { httpRequest } from '@/common/adapter/httpBridge';
import type { ConfigFile } from '@/common/config/configMigration';
import type { Assistant, AssistantDetail } from '@/common/types/agent/assistantTypes';
import type { IMcpServer } from '@/common/config/storage';
import { ipcBridge } from '@/common';
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  getCcbAssistantProfile,
  saveCcbAssistantProfile,
  normalizeCcbAssistantProfileId,
} from './ccbAssistantProfiles';
import {
  assistantDetailToProfileSeed,
  assistantListRowToProfileSeed,
  buildBundledCcbAssistantProfile,
} from './ccbAssistantProfileSeedShared';
import { CCB_WANDING_KEEP_AGENT_IDS } from './ccbAgentCatalog';
import { resolveCcbClaudeConfigDir, stripBuiltinAssistantIdPrefix } from './ccbWandingRuntime';
import { isCcbWandingInstallPresent } from './ccbWandingRuntimeNode';

export const CCB_ASSISTANT_PROFILES_SEED_FLAG = 'migration.ccbAssistantProfilesSeeded_v1' as const;

export type CcbAssistantProfileSeedReport = {
  seeded_at: string;
  config_dir: string;
  profiles_created: string[];
  profiles_skipped_existing: string[];
  profiles_skipped_empty: string[];
  profiles_failed: Array<{ id: string; error: string }>;
};

const SEED_LOCALES = ['zh-CN', 'en-US'] as const;

async function fetchAssistants(): Promise<Assistant[]> {
  return (await httpRequest<Assistant[]>('GET', '/api/assistants')) ?? [];
}

function resolveBackendAssistantIds(assistantId: string): string[] {
  const bare = stripBuiltinAssistantIdPrefix(assistantId);
  return [bare, assistantId].filter((value, index, array) => value.trim().length > 0 && array.indexOf(value) === index);
}

async function fetchAssistantDetail(id: string, locale: string): Promise<AssistantDetail | null> {
  try {
    return await httpRequest<AssistantDetail>(
      'GET',
      `/api/assistants/${encodeURIComponent(id)}?locale=${encodeURIComponent(locale)}`
    );
  } catch {
    return null;
  }
}

async function fetchMcpServers(): Promise<IMcpServer[]> {
  const fromDb = await ipcBridge.mcpService.listServers.invoke().catch((): IMcpServer[] => []);
  if (fromDb.length > 0) {
    return fromDb;
  }
  const backendPrefs = (await httpRequest<Record<string, unknown>>('GET', '/api/settings/client')) || {};
  const legacy = backendPrefs['mcp.config'];
  return Array.isArray(legacy) ? (legacy as IMcpServer[]) : [];
}

function resolveMcpNamesFromIds(mcpIds: string[], servers: readonly IMcpServer[]): string[] {
  return mcpIds
    .map((id) => {
      const matched = servers.find((server) => server.id === id);
      return (matched?.name ?? id.replace(/^ccb-mcp:/, '')).trim();
    })
    .filter((name) => name.length > 0);
}

async function readAssistantRulesContent(backendIds: readonly string[]): Promise<string> {
  for (const backendId of backendIds) {
    for (const locale of SEED_LOCALES) {
      const content = await ipcBridge.fs.readAssistantRule
        .invoke({ assistant_id: backendId, locale })
        .catch(() => '');
      if (content.trim().length > 0) {
        return content.trim();
      }
    }
  }
  return '';
}

async function loadAssistantDetailForSeed(
  assistant: Assistant
): Promise<{ detail: AssistantDetail | null; rulesContent: string }> {
  const backendIds = resolveBackendAssistantIds(assistant.id);
  let firstDetail: AssistantDetail | null = null;

  for (const backendId of backendIds) {
    for (const locale of SEED_LOCALES) {
      const detail = await fetchAssistantDetail(backendId, locale);
      if (!detail) {
        continue;
      }
      if (!firstDetail) {
        firstDetail = detail;
      }
      if (detail.rules?.content?.trim()) {
        return { detail, rulesContent: detail.rules.content.trim() };
      }
    }
  }

  if (firstDetail) {
    return { detail: firstDetail, rulesContent: firstDetail.rules.content?.trim() ?? '' };
  }

  const rulesContent = await readAssistantRulesContent(backendIds);
  return { detail: null, rulesContent };
}

export function isCcbAssistantProfileSeedSuccessful(
  report: CcbAssistantProfileSeedReport,
  expectedBuiltinCount: number
): boolean {
  if (report.profiles_failed.length > 0) {
    return false;
  }
  if (expectedBuiltinCount === 0) {
    return true;
  }
  if (report.profiles_created.length > 0) {
    return true;
  }
  if (report.profiles_skipped_existing.length >= expectedBuiltinCount) {
    return true;
  }
  return false;
}

async function shouldRetryCcbAssistantProfileSeed(
  configFile: ConfigFile,
  configDir: string
): Promise<boolean> {
  let flagged = false;
  try {
    flagged = Boolean(await configFile.get(CCB_ASSISTANT_PROFILES_SEED_FLAG));
  } catch {
    return true;
  }
  if (!flagged) {
    return true;
  }

  const profilesDir = join(configDir, 'assistants');
  if (!existsSync(profilesDir)) {
    return true;
  }

  try {
    const entries = await readdir(profilesDir);
    if (entries.filter((entry) => entry.endsWith('.json')).length === 0) {
      return true;
    }
  } catch {
    return true;
  }

  const reportPath = join(configDir, 'aionui-assistant-profiles-seed-report.json');
  if (!existsSync(reportPath)) {
    return false;
  }

  try {
    const report = JSON.parse(
      (await readFile(reportPath, 'utf8')).replace(/^\uFEFF/, '')
    ) as CcbAssistantProfileSeedReport;
    if (
      report.profiles_created.length === 0 &&
      report.profiles_skipped_existing.length === 0 &&
      report.profiles_skipped_empty.length > 0
    ) {
      return true;
    }
  } catch {
    // keep flagged completion when report is unreadable but profiles exist
  }

  return false;
}

export async function seedBuiltinAssistantsToCcbProfiles(
  configDir = resolveCcbClaudeConfigDir(),
  preloadedAssistants?: Assistant[]
): Promise<CcbAssistantProfileSeedReport | null> {
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    return null;
  }

  const report: CcbAssistantProfileSeedReport = {
    seeded_at: new Date().toISOString(),
    config_dir: configDir,
    profiles_created: [],
    profiles_skipped_existing: [],
    profiles_skipped_empty: [],
    profiles_failed: [],
  };

  const assistants = preloadedAssistants ?? (await fetchAssistants());
  const mcpServers = await fetchMcpServers();
  const builtins = assistants.filter((assistant) => assistant.source === 'builtin' && assistant.enabled !== false);

  for (const assistant of builtins) {
    const profileId = normalizeCcbAssistantProfileId(stripBuiltinAssistantIdPrefix(assistant.id));
    if (!profileId) {
      report.profiles_skipped_empty.push(assistant.id);
      continue;
    }
    if (!CCB_WANDING_KEEP_AGENT_IDS.has(profileId)) {
      console.info(`[migration.ccbAssistantProfilesSeed] id=${profileId} action=skip reason=not_in_wanding_keep_set`);
      continue;
    }

    const existing = await getCcbAssistantProfile(profileId);
    if (existing) {
      report.profiles_skipped_existing.push(profileId);
      continue;
    }

    try {
      const { detail, rulesContent } = await loadAssistantDetailForSeed(assistant);
      const seedInput = detail
        ? assistantDetailToProfileSeed(detail, assistant.name)
        : assistantListRowToProfileSeed(assistant, rulesContent);

      if (!seedInput.rulesContent?.trim() && rulesContent.trim()) {
        seedInput.rulesContent = rulesContent;
      }
      if (!seedInput.rulesContent?.trim()) {
        const listFallback = assistantListRowToProfileSeed(assistant, rulesContent);
        if (listFallback.rulesContent?.trim()) {
          seedInput.rulesContent = listFallback.rulesContent;
        }
      }
      if (seedInput.mcpNames?.length === 0 && detail && detail.preferences.last_mcp_ids.length > 0) {
        seedInput.mcpNames = resolveMcpNamesFromIds(detail.preferences.last_mcp_ids, mcpServers);
      }
      if (seedInput.enabledSkills?.length === 0 && assistant.enabled_skills.length > 0) {
        seedInput.enabledSkills = assistant.enabled_skills;
      }

      const profile = buildBundledCcbAssistantProfile(seedInput);
      if (!profile) {
        report.profiles_skipped_empty.push(profileId);
        continue;
      }

      await saveCcbAssistantProfile(profile);
      report.profiles_created.push(profileId);
    } catch (error) {
      report.profiles_failed.push({
        id: profileId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const reportPath = join(configDir, 'aionui-assistant-profiles-seed-report.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

export async function migrateBuiltinAssistantsToCcbProfiles(configFile: ConfigFile): Promise<boolean> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    console.info('[Migration] CCB assistant profile seed deferred — CCB-Wanding install not detected');
    return true;
  }

  const needsSeed = await shouldRetryCcbAssistantProfileSeed(configFile, configDir);
  if (!needsSeed) {
    console.info('[Migration] CCB assistant profile seed skipped — already complete');
    return true;
  }

  try {
    const assistants = await fetchAssistants();
    const builtins = assistants.filter((assistant) => assistant.source === 'builtin' && assistant.enabled !== false);
    const report = await seedBuiltinAssistantsToCcbProfiles(configDir, assistants);
    const success = report ? isCcbAssistantProfileSeedSuccessful(report, builtins.length) : false;

    if (success) {
      await configFile.set(CCB_ASSISTANT_PROFILES_SEED_FLAG, true);
    } else {
      try {
        await configFile.set(CCB_ASSISTANT_PROFILES_SEED_FLAG, false);
      } catch {
        // first run may not have the key yet
      }
      console.warn('[Migration] CCB assistant profile seed incomplete — will retry on next launch');
    }

    console.info(
      '[Migration] CCB assistant profile seed %s: created=%d skipped=%d empty=%d failed=%d report=%s',
      success ? 'completed' : 'partial',
      report?.profiles_created.length ?? 0,
      report?.profiles_skipped_existing.length ?? 0,
      report?.profiles_skipped_empty.length ?? 0,
      report?.profiles_failed.length ?? 0,
      join(configDir, 'aionui-assistant-profiles-seed-report.json')
    );
    return success;
  } catch (error) {
    console.error('[Migration] CCB assistant profile seed failed', error);
    return false;
  }
}

/** Idempotent check used by tests — verifies profiles dir exists after seed. */
export function ccbAssistantProfilesDirExists(configDir = resolveCcbClaudeConfigDir()): boolean {
  if (!configDir) return false;
  return existsSync(join(configDir, 'assistants'));
}
