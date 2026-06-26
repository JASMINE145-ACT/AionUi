/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Main-process CCB config migration (uses node:fs). Renderer must import
 * from ccbConfigMigrationShared.ts instead.
 */

import { ipcBridge } from '@/common';
import { httpRequest } from '@/common/adapter/httpBridge';
import type { ConfigFile } from '@/common/config/configMigration';
import type { IMcpServer } from '@/common/config/storage';
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveCcbClaudeConfigDir } from './ccbWandingRuntime';
import { isCcbWandingInstallPresent } from './ccbWandingRuntimeNode';
import { syncAionUiCorpusSkillsToCcbWanding } from './ccbSkills';
import {
  CCB_RUNTIME_MIGRATION_FLAG,
  mergeMcpIntoCcbSettings,
  safeSkillDirectoryName,
  type MigrationReport,
  type SettingsJson,
  type SkillRecord,
} from './ccbConfigMigrationShared';

export {
  CCB_RUNTIME_MIGRATION_FLAG,
  mergeMcpIntoCcbSettings,
  mcpServerToSettingsEntry,
  normalizeMcpServerName,
  safeSkillDirectoryName,
  stripAionUiRuntimeOverridesForCcb,
  stripCcbConversationExtra,
  type CcbSessionRuntimeOverrides,
  type MigrationReport,
  type SkillRecord,
} from './ccbConfigMigrationShared';

async function readSettingsJson(configDir: string): Promise<SettingsJson> {
  const settingsPath = join(configDir, 'settings.json');
  if (!existsSync(settingsPath)) {
    return {};
  }
  const raw = (await readFile(settingsPath, 'utf8')).replace(/^\uFEFF/, '');
  return JSON.parse(raw) as SettingsJson;
}

async function backupSettingsJson(configDir: string): Promise<string | undefined> {
  const settingsPath = join(configDir, 'settings.json');
  if (!existsSync(settingsPath)) {
    return undefined;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(configDir, `settings.json.aionui-migration-backup-${stamp}`);
  await copyFile(settingsPath, backupPath);
  return backupPath;
}

async function fetchAionUiMcpServers(): Promise<IMcpServer[]> {
  const fromDb = await ipcBridge.mcpService.listServers.invoke().catch((): IMcpServer[] => []);
  if (fromDb.length > 0) {
    return fromDb.filter((server) => !server.builtin);
  }

  const backendPrefs = (await httpRequest<Record<string, unknown>>('GET', '/api/settings/client')) || {};
  const legacy = backendPrefs['mcp.config'];
  return Array.isArray(legacy) ? (legacy as IMcpServer[]).filter((server) => !server?.builtin) : [];
}

async function fetchAionUiUserSkills(): Promise<SkillRecord[]> {
  const skills = await httpRequest<SkillRecord[]>('GET', '/api/skills').catch((): SkillRecord[] => []);
  return (skills ?? []).filter((skill) => !skill.builtin);
}

async function copySkillsToCcb(
  configDir: string,
  skills: readonly SkillRecord[]
): Promise<{ copied: string[]; skippedExisting: string[]; manual: string[] }> {
  const targetRoot = join(configDir, 'skills');
  await mkdir(targetRoot, { recursive: true });

  const copied: string[] = [];
  const skippedExisting: string[] = [];
  const manual: string[] = [];

  for (const skill of skills) {
    const sourcePath = skill.source_path ?? skill.path;
    if (!sourcePath || !existsSync(sourcePath)) {
      manual.push(skill.name);
      continue;
    }
    const safeName = safeSkillDirectoryName(skill.name);
    if (!safeName) {
      manual.push(skill.name);
      continue;
    }
    const destDir = join(targetRoot, safeName);
    if (existsSync(destDir)) {
      skippedExisting.push(skill.name);
      continue;
    }
    await cp(sourcePath, destDir, { recursive: true });
    copied.push(skill.name);
  }

  return { copied, skippedExisting, manual };
}

export async function exportAionUiRuntimeConfigToCcb(
  configDir: string,
  mcpServers: readonly IMcpServer[],
  skills: readonly SkillRecord[]
): Promise<MigrationReport> {
  const report: MigrationReport = {
    migrated_at: new Date().toISOString(),
    config_dir: configDir,
    mcp_imported: [],
    mcp_skipped_existing: [],
    mcp_skipped_reserved: [],
    skills_copied: [],
    skills_skipped_existing: [],
    skills_manual: [],
    errors: [],
  };

  const existingSettings = await readSettingsJson(configDir);
  const { settings, imported, skippedExisting, skippedReserved } = mergeMcpIntoCcbSettings(
    existingSettings,
    mcpServers
  );

  if (imported.length > 0) {
    report.backup_settings_path = await backupSettingsJson(configDir);
    await writeFile(join(configDir, 'settings.json'), `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  }

  report.mcp_imported = imported;
  report.mcp_skipped_existing = skippedExisting;
  report.mcp_skipped_reserved = skippedReserved;

  const skillResult = await copySkillsToCcb(configDir, skills);
  report.skills_copied = skillResult.copied;
  report.skills_skipped_existing = skillResult.skippedExisting;
  report.skills_manual = skillResult.manual;

  const corpusSync = await syncAionUiCorpusSkillsToCcbWanding();
  report.skills_copied = [...report.skills_copied, ...corpusSync.copied];
  report.skills_skipped_existing = [...report.skills_skipped_existing, ...corpusSync.skipped_existing];
  report.skills_manual = [...report.skills_manual, ...corpusSync.skipped_missing];
  if (corpusSync.errors.length > 0) {
    report.errors.push(...corpusSync.errors);
  }

  await writeFile(join(configDir, 'aionui-migration-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

export async function migrateAionUiRuntimeConfigToCcb(configFile: ConfigFile): Promise<boolean> {
  let alreadyMigrated = false;
  try {
    alreadyMigrated = Boolean(await configFile.get(CCB_RUNTIME_MIGRATION_FLAG));
  } catch {
    // first run
  }
  if (alreadyMigrated) {
    console.info('[Migration] CCB runtime config migration skipped — completion flag already set');
    return true;
  }

  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    console.info('[Migration] CCB runtime config migration deferred — CCB-Wanding install not detected');
    return true;
  }

  try {
    const [mcpServers, skills] = await Promise.all([fetchAionUiMcpServers(), fetchAionUiUserSkills()]);
    const report = await exportAionUiRuntimeConfigToCcb(configDir, mcpServers, skills);
    await configFile.set(CCB_RUNTIME_MIGRATION_FLAG, true);

    console.info(
      '[Migration] CCB runtime config migration completed: mcp imported=%d, skills copied=%d, report=%s',
      report.mcp_imported.length,
      report.skills_copied.length,
      join(configDir, 'aionui-migration-report.json')
    );
    return true;
  } catch (error) {
    const report: MigrationReport = {
      migrated_at: new Date().toISOString(),
      config_dir: configDir,
      mcp_imported: [],
      mcp_skipped_existing: [],
      mcp_skipped_reserved: [],
      skills_copied: [],
      skills_skipped_existing: [],
      skills_manual: [],
      errors: [],
    };
    report.errors.push(error instanceof Error ? error.message : String(error));
    try {
      await writeFile(join(configDir, 'aionui-migration-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    } catch {
      // best effort
    }
    console.error('[Migration] CCB runtime config migration failed', error);
    return false;
  }
}
