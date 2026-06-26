/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * One-shot migration from CCB-Wanding assistants/*.json to agents/*.md + sidecar.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ConfigFile } from '@/common/config/configMigration';
import { ccbAgentInputFromProfile } from './ccbAgentCatalog';
import {
  getCcbAssistantProfile,
  listCcbAssistantProfiles,
  normalizeCcbAssistantProfile,
  type CcbAssistantProfile,
} from './ccbAssistantProfiles';
import { getCcbAgent, listCcbAgents, saveCcbAgent } from './ccbAgents';
import { CCB_DEFAULT_SESSION_AGENT_ID, CCB_GUID_HIDDEN_AGENT_IDS, CCB_WANDING_KEEP_AGENT_IDS, CCB_WANDING_OFFICE_PRESET_IDS, isRouterDelegatableAgentId } from './ccbAgentCatalog';
import { resolveCcbClaudeConfigDir } from './ccbWandingRuntime';
import { isCcbWandingInstallPresent } from './ccbWandingRuntimeNode';

export const CCB_AGENTS_UNIFIED_FLAG = 'migration.ccbAgentsUnified_v1' as const;
export const CCB_AGENTS_GUID_CATALOG_FLAG = 'migration.ccbAgentsGuidCatalog_v1' as const;
export const CCB_WANDING_PRUNE_PRESETS_FLAG = 'migration.ccbWandingPrunePresets_v1' as const;
export const CCB_WANDING_MCP_SERVERS_FLAG = 'migration.ccbWandingMcpServers_v1' as const;
export const CCB_WANDING_OFFICE_DELEGATABLE_FLAG = 'migration.ccbWandingOfficeDelegatable_v1' as const;
export const CCB_WANDING_GLOBAL_ROUTER_FLAG = 'migration.ccbWandingGlobalRouter_v1' as const;
export const CCB_WANDING_SPECIALIST_GUID_CARDS_FLAG = 'migration.ccbWandingSpecialistGuidCards_v1' as const;
export const CCB_WANDING_OFFICE_AGENT_TYPE_IDS_FLAG =
  'migration.ccbWandingOfficeAgentTypeIds_v1' as const;
export const CCB_WANDING_WORD_CREATOR_OFFICE_WORD_FLAG =
  'migration.ccbWandingWordCreatorOfficeWord_v1' as const;
export const CCB_WANDING_EXCEL_CREATOR_EXCEL_MCP_FLAG =
  'migration.ccbWandingExcelCreatorExcelMcp_v1' as const;
export const CCB_WANDING_AGENT_MD_BOM_FLAG = 'migration.ccbWandingAgentMdBom_v1' as const;
export const CCB_WANDING_L1_SELF_CONTAINED_FLAG = 'migration.ccbWandingL1SelfContained_v1' as const;

/** Guid display labels when repairing legacy frontmatter `name` (Chinese) → agent id */
const OFFICE_AGENT_DISPLAY_NAMES: Record<string, string> = {
  'word-creator': 'Word 文档助手',
  'ppt-creator': 'PPT 演示助手',
  'word-form-creator': '可填表单助手',
  'excel-creator': 'Excel 表格助手',
};

const WAN_D_SUBAGENT_MCP_SERVERS: Record<string, string> = {
  'quotation-agent': 'quotation',
  'accurate-agent': 'accurate',
};

function patchAgentMdMcpServers(mdContent: string, serverName: string): string | null {
  if (/^mcpServers:/m.test(mdContent)) {
    return null;
  }
  const match = mdContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return null;
  }
  const newFrontmatter = `${match[1].trimEnd()}\nmcpServers:\n  - ${serverName}\n`;
  return mdContent.replace(/^---\r?\n[\s\S]*?\r?\n---/, `---\n${newFrontmatter}---`);
}

export type CcbAgentMigrationReport = {
  migrated_at: string;
  config_dir: string;
  profiles_written: string[];
  profiles_skipped: Array<{ id: string; reason: string }>;
  profiles_failed: Array<{ id: string; error: string }>;
};

function logMigrationAction(id: string, action: 'write' | 'skip', reason: string): void {
  console.info(`[migration.ccbAgentsUnified] id=${id} action=${action} reason=${reason}`);
}

async function loadProfileFromFile(profilesDir: string, entry: string): Promise<CcbAssistantProfile | null> {
  try {
    const raw = JSON.parse((await readFile(join(profilesDir, entry), 'utf8')).replace(/^\uFEFF/, ''));
    return normalizeCcbAssistantProfile(raw);
  } catch {
    return null;
  }
}

export async function migrateAssistantProfilesToCcbAgents(
  configDir = resolveCcbClaudeConfigDir(),
  options?: { dryRun?: boolean }
): Promise<CcbAgentMigrationReport | null> {
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    return null;
  }

  const dryRun = options?.dryRun === true;
  const report: CcbAgentMigrationReport = {
    migrated_at: new Date().toISOString(),
    config_dir: configDir,
    profiles_written: [],
    profiles_skipped: [],
    profiles_failed: [],
  };

  const profilesDir = join(configDir, 'assistants');
  if (!existsSync(profilesDir)) {
    return report;
  }

  const entries = (await readdir(profilesDir).catch((): string[] => [])).filter((entry) =>
    entry.endsWith('.json')
  );

  for (const entry of entries) {
    const profile = await loadProfileFromFile(profilesDir, entry);
    if (!profile) {
      const id = entry.replace(/\.json$/, '');
      logMigrationAction(id, 'skip', 'invalid_profile');
      report.profiles_skipped.push({ id, reason: 'invalid_profile' });
      continue;
    }

    const existingAgent = await getCcbAgent(profile.id);
    if (existingAgent) {
      logMigrationAction(profile.id, 'skip', 'agent_exists');
      report.profiles_skipped.push({ id: profile.id, reason: 'agent_exists' });
      continue;
    }

    try {
      if (!dryRun) {
        await saveCcbAgent(ccbAgentInputFromProfile(profile));
      }
      logMigrationAction(profile.id, 'write', dryRun ? 'dry_run' : 'migrated');
      report.profiles_written.push(profile.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logMigrationAction(profile.id, 'skip', `error:${message}`);
      report.profiles_failed.push({ id: profile.id, error: message });
    }
  }

  return report;
}

export function isCcbAgentMigrationSuccessful(report: CcbAgentMigrationReport): boolean {
  return report.profiles_failed.length === 0;
}

export async function migrateAssistantProfilesToCcbAgentsWithFlag(configFile: ConfigFile): Promise<boolean> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    console.info('[Migration] CCB agents unified migration deferred — CCB-Wanding install not detected');
    return true;
  }

  let flagged = false;
  try {
    flagged = Boolean(await configFile.get(CCB_AGENTS_UNIFIED_FLAG));
  } catch {
    flagged = false;
  }
  if (flagged) {
    console.info('[Migration] CCB agents unified migration skipped — already complete');
    return true;
  }

  const profilesDir = join(configDir, 'assistants');
  const hasProfiles = existsSync(profilesDir);
  const legacyProfiles = hasProfiles ? await listCcbAssistantProfiles() : [];

  if (legacyProfiles.length === 0) {
    await configFile.set(CCB_AGENTS_UNIFIED_FLAG, true);
    console.info('[Migration] CCB agents unified migration skipped — no legacy assistant profiles');
    return true;
  }

  try {
    const report = await migrateAssistantProfilesToCcbAgents(configDir, { dryRun: false });
    if (!report) {
      return false;
    }

    const success = isCcbAgentMigrationSuccessful(report);
    if (success) {
      await configFile.set(CCB_AGENTS_UNIFIED_FLAG, true);
    }

    console.info(
      '[Migration] CCB agents unified migration %s: written=%d skipped=%d failed=%d',
      success ? 'completed' : 'partial',
      report.profiles_written.length,
      report.profiles_skipped.length,
      report.profiles_failed.length
    );
    return success;
  } catch (error) {
    console.error('[Migration] CCB agents unified migration failed', error);
    return false;
  }
}

/** Idempotent check used by tests — verifies a profile id has a matching agent record. */
export async function ccbAgentExistsForProfileId(profileId: string): Promise<boolean> {
  const profile = await getCcbAssistantProfile(profileId);
  if (!profile) {
    return false;
  }
  return Boolean(await getCcbAgent(profile.id));
}

function resolveGuidPrimaryForAgent(agent: { id: string; source: CcbAssistantProfile['source'] }): boolean {
  if (CCB_GUID_HIDDEN_AGENT_IDS.has(agent.id)) return false;
  return agent.source === 'bundled';
}

export async function repairGuidCatalogFlags(
  configDir = resolveCcbClaudeConfigDir()
): Promise<{ repaired: string[]; skipped: string[] }> {
  const repaired: string[] = [];
  const skipped: string[] = [];
  if (!configDir) {
    return { repaired, skipped };
  }

  const agents = await listCcbAgents(configDir);
  for (const agent of agents) {
    const targetGuidPrimary = resolveGuidPrimaryForAgent(agent);
    const needsGuidFix = agent.guid_primary !== targetGuidPrimary;
    const needsDelegatableFix =
      CCB_GUID_HIDDEN_AGENT_IDS.has(agent.id) &&
      agent.id !== CCB_DEFAULT_SESSION_AGENT_ID &&
      agent.delegatable === false;
    if (!needsGuidFix && !needsDelegatableFix) {
      skipped.push(agent.id);
      continue;
    }
    await saveCcbAgent({
      ...agent,
      ...(needsGuidFix ? { guid_primary: targetGuidPrimary } : {}),
      ...(needsDelegatableFix ? { delegatable: true } : {}),
    });
    repaired.push(agent.id);
    console.info(`[migration.ccbAgentsGuidCatalog] id=${agent.id} action=repair guid_primary=${targetGuidPrimary}`);
  }

  return { repaired, skipped };
}

export async function repairGuidCatalogFlagsWithFlag(configFile: ConfigFile): Promise<boolean> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    return true;
  }

  let flagged = false;
  try {
    flagged = Boolean(await configFile.get(CCB_AGENTS_GUID_CATALOG_FLAG));
  } catch {
    flagged = false;
  }
  if (flagged) {
    return true;
  }

  try {
    const { repaired, skipped } = await repairGuidCatalogFlags(configDir);
    await configFile.set(CCB_AGENTS_GUID_CATALOG_FLAG, true);
    console.info(
      '[Migration] CCB agents Guid catalog repair completed: repaired=%d skipped=%d',
      repaired.length,
      skipped.length
    );
    return true;
  } catch (error) {
    console.error('[Migration] CCB agents Guid catalog repair failed', error);
    return false;
  }
}

export type CcbAgentPruneReport = {
  pruned_at: string;
  config_dir: string;
  agents_deleted: string[];
  agents_skipped: Array<{ id: string; reason: string }>;
  agents_failed: Array<{ id: string; error: string }>;
};

async function unlinkIfExists(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function pruneBundledAgentsNotInKeepSet(
  configDir = resolveCcbClaudeConfigDir()
): Promise<CcbAgentPruneReport | null> {
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    return null;
  }

  const report: CcbAgentPruneReport = {
    pruned_at: new Date().toISOString(),
    config_dir: configDir,
    agents_deleted: [],
    agents_skipped: [],
    agents_failed: [],
  };

  const agents = await listCcbAgents(configDir);
  const agentsDir = join(configDir, 'agents');
  const assistantsDir = join(configDir, 'assistants');

  for (const agent of agents) {
    if (agent.source !== 'bundled') {
      report.agents_skipped.push({ id: agent.id, reason: 'not_bundled' });
      continue;
    }
    if (CCB_WANDING_KEEP_AGENT_IDS.has(agent.id)) {
      report.agents_skipped.push({ id: agent.id, reason: 'in_keep_set' });
      continue;
    }

    try {
      await unlinkIfExists(join(agentsDir, `${agent.id}.md`));
      await unlinkIfExists(join(agentsDir, `${agent.id}.aionui.json`));
      await unlinkIfExists(join(assistantsDir, `${agent.id}.json`));
      report.agents_deleted.push(agent.id);
      console.info(`[migration.ccbWandingPrunePresets] id=${agent.id} action=delete`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.agents_failed.push({ id: agent.id, error: message });
      console.warn(`[migration.ccbWandingPrunePresets] id=${agent.id} action=failed error=${message}`);
    }
  }

  const reportPath = join(configDir, 'aionui-agent-prune-report.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

export async function pruneBundledAgentsNotInKeepSetWithFlag(configFile: ConfigFile): Promise<boolean> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    return true;
  }

  let flagged = false;
  try {
    flagged = Boolean(await configFile.get(CCB_WANDING_PRUNE_PRESETS_FLAG));
  } catch {
    flagged = false;
  }
  if (flagged) {
    return true;
  }

  try {
    const report = await pruneBundledAgentsNotInKeepSet(configDir);
    if (!report) {
      return false;
    }
    const success = report.agents_failed.length === 0;
    if (success) {
      await configFile.set(CCB_WANDING_PRUNE_PRESETS_FLAG, true);
    }
    console.info(
      '[Migration] CCB WanD preset prune %s: deleted=%d skipped=%d failed=%d',
      success ? 'completed' : 'partial',
      report.agents_deleted.length,
      report.agents_skipped.length,
      report.agents_failed.length
    );
    return success;
  } catch (error) {
    console.error('[Migration] CCB WanD preset prune failed', error);
    return false;
  }
}

export async function repairWanDSubagentMcpServers(
  configDir = resolveCcbClaudeConfigDir()
): Promise<{ repaired: string[]; skipped: string[] }> {
  const repaired: string[] = [];
  const skipped: string[] = [];
  if (!configDir) {
    return { repaired, skipped };
  }

  const agentsDir = join(configDir, 'agents');
  for (const [agentId, serverName] of Object.entries(WAN_D_SUBAGENT_MCP_SERVERS)) {
    const mdPath = join(agentsDir, `${agentId}.md`);
    if (!existsSync(mdPath)) {
      skipped.push(agentId);
      continue;
    }
    const raw = await readFile(mdPath, 'utf8');
    const patched = patchAgentMdMcpServers(raw, serverName);
    if (!patched) {
      skipped.push(agentId);
      continue;
    }
    await writeFile(mdPath, patched, 'utf8');
    repaired.push(agentId);
    console.info(`[migration.ccbWandingMcpServers] id=${agentId} action=repair mcpServers=${serverName}`);
  }

  return { repaired, skipped };
}

export async function repairWanDSubagentMcpServersWithFlag(configFile: ConfigFile): Promise<boolean> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    return true;
  }

  let flagged = false;
  try {
    flagged = Boolean(await configFile.get(CCB_WANDING_MCP_SERVERS_FLAG));
  } catch {
    flagged = false;
  }
  if (flagged) {
    return true;
  }

  try {
    const { repaired, skipped } = await repairWanDSubagentMcpServers(configDir);
    await configFile.set(CCB_WANDING_MCP_SERVERS_FLAG, true);
    console.info(
      '[Migration] CCB WanD subagent mcpServers repair completed: repaired=%d skipped=%d',
      repaired.length,
      skipped.length
    );
    return true;
  } catch (error) {
    console.error('[Migration] CCB WanD subagent mcpServers repair failed', error);
    return false;
  }
}

export async function repairGlobalRouterCatalog(
  configDir = resolveCcbClaudeConfigDir()
): Promise<{ repaired: string[]; skipped: string[] }> {
  const repaired: string[] = [];
  const skipped: string[] = [];
  if (!configDir) {
    return { repaired, skipped };
  }

  const agents = await listCcbAgents(configDir);
  for (const agent of agents) {
    const patch: { guid_primary?: boolean; delegatable?: boolean } = {};

    if (agent.id === CCB_DEFAULT_SESSION_AGENT_ID) {
      if (agent.guid_primary !== false) patch.guid_primary = false;
      if (agent.delegatable !== false) patch.delegatable = false;
    } else if (isRouterDelegatableAgentId(agent.id)) {
      if (agent.delegatable !== true) patch.delegatable = true;
      const targetGuidPrimary = resolveGuidPrimaryForAgent(agent);
      if (agent.guid_primary !== targetGuidPrimary) patch.guid_primary = targetGuidPrimary;
    }

    if (Object.keys(patch).length === 0) {
      skipped.push(agent.id);
      continue;
    }
    await saveCcbAgent({ ...agent, ...patch });
    repaired.push(agent.id);
    console.info(`[migration.ccbWandingGlobalRouter] id=${agent.id} patch=${JSON.stringify(patch)}`);
  }

  return { repaired, skipped };
}

export async function repairGlobalRouterCatalogWithFlag(configFile: ConfigFile): Promise<boolean> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    return true;
  }

  let flagged = false;
  try {
    flagged = Boolean(await configFile.get(CCB_WANDING_GLOBAL_ROUTER_FLAG));
  } catch {
    flagged = false;
  }
  if (flagged) {
    return true;
  }

  try {
    const { repaired, skipped } = await repairGlobalRouterCatalog(configDir);
    await configFile.set(CCB_WANDING_GLOBAL_ROUTER_FLAG, true);
    console.info(
      '[Migration] CCB global router catalog repair completed: repaired=%d skipped=%d',
      repaired.length,
      skipped.length
    );
    return true;
  } catch (error) {
    console.error('[Migration] CCB global router catalog repair failed', error);
    return false;
  }
}

export async function repairWanDSpecialistGuidCards(
  configDir = resolveCcbClaudeConfigDir()
): Promise<{ repaired: string[]; skipped: string[] }> {
  const repaired: string[] = [];
  const skipped: string[] = [];
  if (!configDir) {
    return { repaired, skipped };
  }

  const specialistIds = ['quotation-agent', 'accurate-agent'] as const;
  const sortOrders: Record<(typeof specialistIds)[number], number> = {
    'quotation-agent': 100,
    'accurate-agent': 110,
  };

  for (const id of specialistIds) {
    const agent = await getCcbAgent(id, configDir);
    if (!agent) {
      skipped.push(id);
      continue;
    }
    const patch: { guid_primary?: boolean; sort_order?: number } = {};
    if (agent.guid_primary !== true) patch.guid_primary = true;
    if (agent.sort_order !== sortOrders[id]) patch.sort_order = sortOrders[id];
    if (Object.keys(patch).length === 0) {
      skipped.push(id);
      continue;
    }
    await saveCcbAgent({ ...agent, ...patch });
    repaired.push(id);
    console.info(`[migration.ccbWandingSpecialistGuidCards] id=${id} patch=${JSON.stringify(patch)}`);
  }

  return { repaired, skipped };
}

export async function repairWanDSpecialistGuidCardsWithFlag(configFile: ConfigFile): Promise<boolean> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    return true;
  }

  let flagged = false;
  try {
    flagged = Boolean(await configFile.get(CCB_WANDING_SPECIALIST_GUID_CARDS_FLAG));
  } catch {
    flagged = false;
  }
  if (flagged) {
    return true;
  }

  try {
    const { repaired, skipped } = await repairWanDSpecialistGuidCards(configDir);
    await configFile.set(CCB_WANDING_SPECIALIST_GUID_CARDS_FLAG, true);
    console.info(
      '[Migration] CCB WanD specialist Guid cards repair completed: repaired=%d skipped=%d',
      repaired.length,
      skipped.length
    );
    return true;
  } catch (error) {
    console.error('[Migration] CCB WanD specialist Guid cards repair failed', error);
    return false;
  }
}

export async function repairOfficePresetDelegatable(
  configDir = resolveCcbClaudeConfigDir()
): Promise<{ repaired: string[]; skipped: string[] }> {
  const repaired: string[] = [];
  const skipped: string[] = [];
  if (!configDir) {
    return { repaired, skipped };
  }

  const agents = await listCcbAgents(configDir);
  for (const agent of agents) {
    if (!CCB_WANDING_OFFICE_PRESET_IDS.has(agent.id)) {
      skipped.push(agent.id);
      continue;
    }
    if (agent.delegatable === false) {
      skipped.push(agent.id);
      continue;
    }
    await saveCcbAgent({ ...agent, delegatable: false });
    repaired.push(agent.id);
    console.info(`[migration.ccbWandingOfficeDelegatable] id=${agent.id} action=repair delegatable=false`);
  }

  return { repaired, skipped };
}

export async function repairOfficePresetDelegatableWithFlag(configFile: ConfigFile): Promise<boolean> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    return true;
  }

  let flagged = false;
  try {
    flagged = Boolean(await configFile.get(CCB_WANDING_OFFICE_DELEGATABLE_FLAG));
  } catch {
    flagged = false;
  }
  if (flagged) {
    return true;
  }

  try {
    const { repaired, skipped } = await repairOfficePresetDelegatable(configDir);
    await configFile.set(CCB_WANDING_OFFICE_DELEGATABLE_FLAG, true);
    console.info(
      '[Migration] CCB office preset delegatable repair completed: repaired=%d skipped=%d',
      repaired.length,
      skipped.length
    );
    return true;
  } catch (error) {
    console.error('[Migration] CCB office preset delegatable repair failed', error);
    return false;
  }
}

/** Align office preset frontmatter `name` with agent id so Agent(subagent_type) resolves. */
export async function repairOfficeAgentAgentTypeIds(
  configDir = resolveCcbClaudeConfigDir()
): Promise<{ repaired: string[]; skipped: string[] }> {
  const repaired: string[] = [];
  const skipped: string[] = [];
  if (!configDir) {
    return { repaired, skipped };
  }

  for (const id of CCB_WANDING_OFFICE_PRESET_IDS) {
    const agent = await getCcbAgent(id);
    if (!agent) {
      skipped.push(id);
      continue;
    }

    const legacyDisplay =
      agent.name !== id
        ? agent.name
        : agent.display_name?.trim() || OFFICE_AGENT_DISPLAY_NAMES[id] || id;
    const needsNameFix = agent.name !== id;
    const needsDisplayName = !agent.display_name?.trim() && legacyDisplay !== id;

    if (!needsNameFix && !needsDisplayName) {
      skipped.push(id);
      continue;
    }

    await saveCcbAgent({
      ...agent,
      name: id,
      ...(needsDisplayName || agent.display_name?.trim()
        ? { display_name: agent.display_name?.trim() || legacyDisplay }
        : {}),
    });
    repaired.push(id);
    console.info(
      `[migration.ccbWandingOfficeAgentTypeIds] id=${id} action=repair name=${id} display_name=${agent.display_name?.trim() || legacyDisplay}`,
    );
  }

  return { repaired, skipped };
}

export async function repairOfficeAgentAgentTypeIdsWithFlag(
  configFile: ConfigFile
): Promise<boolean> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    return true;
  }

  let flagged = false;
  try {
    flagged = Boolean(await configFile.get(CCB_WANDING_OFFICE_AGENT_TYPE_IDS_FLAG));
  } catch {
    flagged = false;
  }
  if (flagged) {
    return true;
  }

  try {
    const { repaired, skipped } = await repairOfficeAgentAgentTypeIds(configDir);
    await configFile.set(CCB_WANDING_OFFICE_AGENT_TYPE_IDS_FLAG, true);
    console.info(
      '[Migration] CCB office agent type id repair completed: repaired=%d skipped=%d',
      repaired.length,
      skipped.length
    );
    return true;
  } catch (error) {
    console.error('[Migration] CCB office agent type id repair failed', error);
    return false;
  }
}

const WORD_CREATOR_OFFICE_WORD_CLAUDE_MD =
  '# Word 文档助手\n\n**只使用 office-word MCP**（禁止 officecli / skill）。直接调用 `mcp__office-word__*`；禁止 ExecuteExtraTool。\n\n流程：create_document → add_heading / add_paragraph / add_table → 交付前 get_document_text 验证。线程已有表格时原样写入，勿重查业务数据。';

const WORD_CREATOR_OFFICE_WORD_DESCRIPTION =
  '使用 Office-Word MCP 创建、编辑和分析专业 Word 文档。报告、方案、信函、备忘录等。';

/** Switch word-creator from officecli-docx skill to office-word MCP only. */
export async function repairWordCreatorOfficeWordMcp(
  configDir = resolveCcbClaudeConfigDir()
): Promise<{ repaired: string[]; skipped: string[] }> {
  const repaired: string[] = [];
  const skipped: string[] = [];
  if (!configDir) {
    return { repaired, skipped };
  }

  const agent = await getCcbAgent('word-creator');
  if (!agent) {
    skipped.push('word-creator');
    return { repaired, skipped };
  }

  const mdPath = join(configDir, 'agents', 'word-creator.md');
  const mdRaw = existsSync(mdPath) ? await readFile(mdPath, 'utf8') : '';
  const hasLegacySkill = agent.skills.enabled.includes('officecli-docx');
  const hasOfficeWordMcp = agent.mcp_allowlist.includes('office-word');
  const mdNeedsRepair =
    mdRaw.includes('officecli-docx') ||
    mdRaw.includes('skills: officecli-docx') ||
    !/^mcpServers:\s*\n\s*- office-word/m.test(mdRaw);

  if (!hasLegacySkill && hasOfficeWordMcp && !mdNeedsRepair) {
    skipped.push('word-creator');
    return { repaired, skipped };
  }

  await saveCcbAgent({
    ...agent,
    name: 'word-creator',
    description: WORD_CREATOR_OFFICE_WORD_DESCRIPTION,
    mcp_allowlist: ['office-word'],
    skills: {
      enabled: agent.skills.enabled.filter((skill) => skill !== 'officecli-docx'),
      disabled: agent.skills.disabled,
    },
    claude_md: WORD_CREATOR_OFFICE_WORD_CLAUDE_MD,
  });

  if (existsSync(mdPath) && mdNeedsRepair) {
    const seedCandidates = [
      join(
        configDir,
        '..',
        '..',
        '..',
        'Projects',
        'claude-code-best',
        'ccb-installer',
        'config',
        'agents',
        'word-creator.md'
      ),
      'D:\\Projects\\claude-code-best\\ccb-installer\\config\\agents\\word-creator.md',
    ];
    let nextMd: string | null = null;
    for (const seedPath of seedCandidates) {
      if (existsSync(seedPath)) {
        nextMd = await readFile(seedPath, 'utf8');
        break;
      }
    }
    if (!nextMd) {
      let patched = mdRaw.replace(/^skills: officecli-docx\n/m, '');
      patched = patchAgentMdMcpServers(patched, 'office-word') ?? patched;
      patched = patched.replace(
        /description: "使用 officecli[^"]*"/,
        `description: "${WORD_CREATOR_OFFICE_WORD_DESCRIPTION}"`
      );
      nextMd = patched;
    }
    // saveCcbAgent overwrites .md without mcpServers/body — restore full L1 after sidecar write.
    await writeFile(mdPath, nextMd, 'utf8');
  }

  repaired.push('word-creator');
  console.info('[migration.ccbWandingWordCreatorOfficeWord] id=word-creator action=repair mcp=office-word');
  return { repaired, skipped };
}

export async function repairWordCreatorOfficeWordMcpWithFlag(
  configFile: ConfigFile
): Promise<boolean> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    return true;
  }

  let flagged = false;
  try {
    flagged = Boolean(await configFile.get(CCB_WANDING_WORD_CREATOR_OFFICE_WORD_FLAG));
  } catch {
    flagged = false;
  }
  if (flagged) {
    return true;
  }

  try {
    const { repaired, skipped } = await repairWordCreatorOfficeWordMcp(configDir);
    await configFile.set(CCB_WANDING_WORD_CREATOR_OFFICE_WORD_FLAG, true);
    console.info(
      '[Migration] CCB word-creator office-word MCP repair completed: repaired=%d skipped=%d',
      repaired.length,
      skipped.length
    );
    return true;
  } catch (error) {
    console.error('[Migration] CCB word-creator office-word MCP repair failed', error);
    return false;
  }
}

const EXCEL_CREATOR_EXCEL_MCP_CLAUDE_MD =
  '# Excel 表格助手\n\n**只使用 excel MCP**（haris-musa/excel-mcp-server；禁止 officecli / skill）。直接调用 `mcp__excel__*`；禁止 ExecuteExtraTool。\n\n流程：create_workbook → write_data_to_excel → apply_formula → 交付前 read_data_from_excel 验证。禁止硬编码计算结果。';

const EXCEL_CREATOR_EXCEL_MCP_DESCRIPTION =
  '使用 excel MCP 创建、编辑和分析专业 Excel 表格。财务模型、数据看板、追踪表和数据分析。';

/** Switch excel-creator from officecli-xlsx skill to haris excel MCP only. */
export async function repairExcelCreatorExcelMcp(
  configDir = resolveCcbClaudeConfigDir()
): Promise<{ repaired: string[]; skipped: string[] }> {
  const repaired: string[] = [];
  const skipped: string[] = [];
  if (!configDir) {
    return { repaired, skipped };
  }

  const agent = await getCcbAgent('excel-creator');
  if (!agent) {
    skipped.push('excel-creator');
    return { repaired, skipped };
  }

  const mdPath = join(configDir, 'agents', 'excel-creator.md');
  const mdRaw = existsSync(mdPath) ? await readFile(mdPath, 'utf8') : '';
  const hasLegacySkill = agent.skills.enabled.includes('officecli-xlsx');
  const hasExcelMcp = agent.mcp_allowlist.includes('excel');
  const mdNeedsRepair =
    mdRaw.includes('officecli-xlsx') ||
    mdRaw.includes('skills: officecli-xlsx') ||
    !/^mcpServers:\s*\n\s*- excel/m.test(mdRaw);

  if (!hasLegacySkill && hasExcelMcp && !mdNeedsRepair) {
    skipped.push('excel-creator');
    return { repaired, skipped };
  }

  await saveCcbAgent({
    ...agent,
    name: 'excel-creator',
    description: EXCEL_CREATOR_EXCEL_MCP_DESCRIPTION,
    mcp_allowlist: ['excel'],
    skills: {
      enabled: agent.skills.enabled.filter((skill) => skill !== 'officecli-xlsx'),
      disabled: agent.skills.disabled,
    },
    claude_md: EXCEL_CREATOR_EXCEL_MCP_CLAUDE_MD,
  });

  if (existsSync(mdPath) && mdNeedsRepair) {
    const seedCandidates = [
      join(
        configDir,
        '..',
        '..',
        '..',
        'Projects',
        'claude-code-best',
        'ccb-installer',
        'config',
        'agents',
        'excel-creator.md'
      ),
      'D:\\Projects\\claude-code-best\\ccb-installer\\config\\agents\\excel-creator.md',
    ];
    let nextMd: string | null = null;
    for (const seedPath of seedCandidates) {
      if (existsSync(seedPath)) {
        nextMd = await readFile(seedPath, 'utf8');
        break;
      }
    }
    if (!nextMd) {
      let patched = mdRaw.replace(/^skills: officecli-xlsx\n/m, '');
      patched = patchAgentMdMcpServers(patched, 'excel') ?? patched;
      patched = patched.replace(
        /description: "使用 officecli[^"]*"/,
        `description: "${EXCEL_CREATOR_EXCEL_MCP_DESCRIPTION}"`
      );
      nextMd = patched;
    }
    await writeFile(mdPath, nextMd, 'utf8');
  }

  repaired.push('excel-creator');
  console.info('[migration.ccbWandingExcelCreatorExcelMcp] id=excel-creator action=repair mcp=excel');
  return { repaired, skipped };
}

export async function repairExcelCreatorExcelMcpWithFlag(
  configFile: ConfigFile
): Promise<boolean> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    return true;
  }

  let flagged = false;
  try {
    flagged = Boolean(await configFile.get(CCB_WANDING_EXCEL_CREATOR_EXCEL_MCP_FLAG));
  } catch {
    flagged = false;
  }
  if (flagged) {
    return true;
  }

  try {
    const { repaired, skipped } = await repairExcelCreatorExcelMcp(configDir);
    await configFile.set(CCB_WANDING_EXCEL_CREATOR_EXCEL_MCP_FLAG, true);
    console.info(
      '[Migration] CCB excel-creator excel MCP repair completed: repaired=%d skipped=%d',
      repaired.length,
      skipped.length
    );
    return true;
  } catch (error) {
    console.error('[Migration] CCB excel-creator excel MCP repair failed', error);
    return false;
  }
}

/** PowerShell Set-Content -Encoding UTF8 writes BOM; claude-code loadAgentsDir frontmatter regex requires leading --- */
export async function repairAgentMarkdownBom(
  configDir = resolveCcbClaudeConfigDir()
): Promise<{ repaired: string[]; skipped: string[] }> {
  const repaired: string[] = [];
  const skipped: string[] = [];
  if (!configDir) {
    return { repaired, skipped };
  }

  const dir = join(configDir, 'agents');
  if (!existsSync(dir)) {
    return { repaired, skipped };
  }

  const entries = await readdir(dir);
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const mdPath = join(dir, entry);
    const raw = await readFile(mdPath);
    if (
      raw.length >= 3 &&
      raw[0] === 0xef &&
      raw[1] === 0xbb &&
      raw[2] === 0xbf
    ) {
      await writeFile(mdPath, raw.subarray(3));
      const id = entry.replace(/\.md$/, '');
      repaired.push(id);
      console.info(`[migration.ccbWandingAgentMdBom] id=${id} action=repair bom=stripped`);
    } else {
      skipped.push(entry.replace(/\.md$/, ''));
    }
  }

  return { repaired, skipped };
}

const GBK_MOJIBAKE_MARKERS = /涓囬紟|鈥\?|銆\?|鍒嗘瀽|鎶ヤ环/;

export async function repairWanDL1SelfContained(
  configDir = resolveCcbClaudeConfigDir()
): Promise<{ repaired: string[]; skipped: string[] }> {
  const repaired: string[] = [];
  const skipped: string[] = [];
  if (!configDir) {
    return { repaired, skipped };
  }

  for (const agent of await listCcbAgents(configDir)) {
    const sidecarMd = agent.claude_md?.trim();
    const body = agent.system_prompt?.trim();
    const desc = agent.description?.trim() ?? '';

    if (!sidecarMd) {
      skipped.push(agent.id);
      continue;
    }

    const saveInput = {
      id: agent.id,
      name: agent.name,
      recommended_prompts: agent.recommended_prompts,
      mcp_allowlist: agent.mcp_allowlist,
      skills: agent.skills,
      source: agent.source,
      ...(agent.display_name ? { display_name: agent.display_name } : {}),
      ...(agent.description ? { description: agent.description } : {}),
      ...(agent.model !== undefined ? { model: agent.model } : {}),
      ...(agent.permission_mode !== undefined ? { permission_mode: agent.permission_mode } : {}),
      ...(agent.guid_primary !== undefined ? { guid_primary: agent.guid_primary } : {}),
      ...(agent.delegatable !== undefined ? { delegatable: agent.delegatable } : {}),
      ...(agent.avatar ? { avatar: agent.avatar } : {}),
      ...(typeof agent.sort_order === 'number' ? { sort_order: agent.sort_order } : {}),
    };

    if (body && !GBK_MOJIBAKE_MARKERS.test(body) && !GBK_MOJIBAKE_MARKERS.test(desc)) {
      await saveCcbAgent({ ...saveInput, system_prompt: body });
      repaired.push(agent.id);
      console.info(`[migration.ccbWandingL1SelfContained] id=${agent.id} action=clear_sidecar_claude_md`);
      continue;
    }

    await saveCcbAgent({
      ...saveInput,
      ...(body ? { system_prompt: body } : { claude_md: sidecarMd }),
    });
    repaired.push(agent.id);
    console.info(`[migration.ccbWandingL1SelfContained] id=${agent.id} action=merge_sidecar_to_l1`);
  }

  return { repaired, skipped };
}

export async function repairWanDL1SelfContainedWithFlag(configFile: ConfigFile): Promise<boolean> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    return true;
  }

  let flagged = false;
  try {
    flagged = Boolean(await configFile.get(CCB_WANDING_L1_SELF_CONTAINED_FLAG));
  } catch {
    flagged = false;
  }
  if (flagged) {
    return true;
  }

  try {
    const { repaired, skipped } = await repairWanDL1SelfContained(configDir);
    await configFile.set(CCB_WANDING_L1_SELF_CONTAINED_FLAG, true);
    console.info(
      '[Migration] CCB WanD L1 self-contained repair completed: repaired=%d skipped=%d',
      repaired.length,
      skipped.length
    );
    return true;
  } catch (error) {
    console.error('[Migration] CCB WanD L1 self-contained repair failed', error);
    return false;
  }
}

export async function repairAgentMarkdownBomWithFlag(configFile: ConfigFile): Promise<boolean> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    return true;
  }

  let flagged = false;
  try {
    flagged = Boolean(await configFile.get(CCB_WANDING_AGENT_MD_BOM_FLAG));
  } catch {
    flagged = false;
  }
  if (flagged) {
    return true;
  }

  try {
    const { repaired, skipped } = await repairAgentMarkdownBom(configDir);
    await configFile.set(CCB_WANDING_AGENT_MD_BOM_FLAG, true);
    console.info(
      '[Migration] CCB agent markdown BOM repair completed: repaired=%d skipped=%d',
      repaired.length,
      skipped.length
    );
    return true;
  } catch (error) {
    console.error('[Migration] CCB agent markdown BOM repair failed', error);
    return false;
  }
}
