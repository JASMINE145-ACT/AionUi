/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Main-process CCB-Wanding skills I/O (uses node:fs). Renderer must use
 * ccbSkillsService IPC — see process/bridge/ccbSkillsBridge.ts.
 */

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync, type Dirent } from 'node:fs';
import { basename, join } from 'node:path';
import { httpRequest } from '@/common/adapter/httpBridge';
import { resolveCcbClaudeConfigDir } from './ccbWandingRuntime';
import { isCcbWandingInstallPresent } from './ccbWandingRuntimeNode';
import { safeSkillDirectoryName } from './ccbConfigMigrationShared';
import {
  AIONUI_MANAGED_SKILL_MARKER,
  mergeAionUiCorpusSkillRecords,
  type AionUiCorpusSkillRecord,
  type CcbSkillSyncResult,
} from './ccbSkillsSyncShared';
export type {
  CcbSkillImportResult,
  CcbSkillInfo,
  CcbSkillPaths,
} from './ccbSkillsShared';
export type { CcbSkillSyncResult } from './ccbSkillsSyncShared';
import type { CcbSkillInfo, CcbSkillPaths } from './ccbSkillsShared';

function parseDescription(markdown: string, fallback: string): string {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (frontmatter?.[1]) {
    const match = frontmatter[1].match(/^description:\s*["']?(.+?)["']?\s*$/m);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  const firstBodyLine = markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---/, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .find((line) => line.length > 0);

  return firstBodyLine ?? fallback;
}

function resolveSkillSource(skillDir: string): CcbSkillInfo['source'] {
  if (existsSync(join(skillDir, AIONUI_MANAGED_SKILL_MARKER))) {
    return 'builtin';
  }
  return 'ccb-wanding';
}

async function fetchAionUiCorpusSkillRecords(): Promise<AionUiCorpusSkillRecord[]> {
  const errors: string[] = [];
  const [autoSkills, availableSkills] = await Promise.all([
    httpRequest<Array<{ name: string; location: string }>>('GET', '/api/skills/builtin-auto').catch((error) => {
      errors.push(`builtin-auto: ${error instanceof Error ? error.message : String(error)}`);
      return [] as Array<{ name: string; location: string }>;
    }),
    httpRequest<Array<{ name: string; location: string; source?: string }>>('GET', '/api/skills').catch((error) => {
      errors.push(`skills: ${error instanceof Error ? error.message : String(error)}`);
      return [] as Array<{ name: string; location: string; source?: string }>;
    }),
  ]);

  if (errors.length > 0 && (autoSkills?.length ?? 0) === 0 && (availableSkills?.length ?? 0) === 0) {
    throw new Error(errors.join('; '));
  }

  return mergeAionUiCorpusSkillRecords(autoSkills ?? [], availableSkills ?? []);
}

export async function syncAionUiCorpusSkillsToCcbWanding(): Promise<CcbSkillSyncResult> {
  const configDir = resolveCcbClaudeConfigDir();
  const result: CcbSkillSyncResult = {
    copied: [],
    refreshed: [],
    skipped_existing: [],
    skipped_missing: [],
    errors: [],
  };

  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    result.errors.push('CCB-Wanding config directory not found');
    return result;
  }

  let skills: AionUiCorpusSkillRecord[] = [];
  try {
    skills = await fetchAionUiCorpusSkillRecords();
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
    return result;
  }

  const targetRoot = join(configDir, 'skills');
  await mkdir(targetRoot, { recursive: true });

  for (const skill of skills) {
    const safeName = safeSkillDirectoryName(skill.name);
    if (!safeName) {
      result.skipped_missing.push(skill.name);
      continue;
    }

    const sourcePath = skill.location;
    const skillFile = join(sourcePath, 'SKILL.md');
    if (!existsSync(sourcePath) || !existsSync(skillFile)) {
      result.skipped_missing.push(skill.name);
      continue;
    }

    const destDir = join(targetRoot, safeName);
    const managedMarker = join(destDir, AIONUI_MANAGED_SKILL_MARKER);
    const alreadyExists = existsSync(destDir);

    if (alreadyExists && !existsSync(managedMarker)) {
      result.skipped_existing.push(skill.name);
      continue;
    }

    try {
      if (alreadyExists) {
        await rm(destDir, { recursive: true, force: true });
      }
      await cp(sourcePath, destDir, { recursive: true });
      await writeFile(
        join(destDir, AIONUI_MANAGED_SKILL_MARKER),
        `${JSON.stringify({ name: skill.name, synced_at: new Date().toISOString(), source: 'aionui-corpus' }, null, 2)}\n`,
        'utf8'
      );
      if (alreadyExists) {
        result.refreshed.push(skill.name);
      } else {
        result.copied.push(skill.name);
      }
    } catch (error) {
      result.errors.push(`${skill.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return result;
}

export function getCcbSkillPaths(): CcbSkillPaths {
  const configDir = resolveCcbClaudeConfigDir();
  const userSkillsDir = configDir ? join(configDir, 'skills') : '';
  return {
    user_skills_dir: userSkillsDir,
    builtin_skills_dir: '',
  };
}

export async function listCcbWandingSkills(): Promise<CcbSkillInfo[]> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    return [];
  }

  const skillsDir = join(configDir, 'skills');
  if (!existsSync(skillsDir)) {
    return [];
  }

  let entries: Dirent[];
  try {
    entries = await readdir(skillsDir, { withFileTypes: true });
  } catch {
    entries = [];
  }
  const skills = await Promise.all(
    entries.map(async (entry): Promise<CcbSkillInfo | null> => {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) {
        return null;
      }

      const skillDir = join(skillsDir, entry.name);
      const skillFile = join(skillDir, 'SKILL.md');
      if (!existsSync(skillFile)) {
        return {
          name: entry.name,
          description: 'Missing SKILL.md',
          location: skillDir,
          relative_location: `${entry.name}/SKILL.md`,
          is_custom: true,
          source: 'ccb-wanding',
          status: 'missing',
        };
      }

      const markdown = await readFile(skillFile, 'utf8').catch(() => '');
      return {
        name: entry.name,
        description: parseDescription(markdown, entry.name),
        location: skillDir,
        relative_location: `${entry.name}/SKILL.md`,
        is_custom: !existsSync(join(skillDir, AIONUI_MANAGED_SKILL_MARKER)),
        source: resolveSkillSource(skillDir),
        status: 'ready',
      };
    })
  );

  return skills.filter((skill): skill is CcbSkillInfo => skill !== null).sort((a, b) => a.name.localeCompare(b.name));
}

async function findImportableSkillDirs(skillPath: string): Promise<string[]> {
  const info = await stat(skillPath);
  if (!info.isDirectory()) {
    throw new Error('Only skill directories are supported for CCB-Wanding import');
  }

  if (existsSync(join(skillPath, 'SKILL.md'))) {
    return [skillPath];
  }

  const entries = await readdir(skillPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => join(skillPath, entry.name))
    .filter((dir) => existsSync(join(dir, 'SKILL.md')));
}

export async function importSkillToCcbWanding(skillPath: string): Promise<{ skill_name: string; skill_names?: string[] }> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    throw new Error('CCB-Wanding config directory not found');
  }

  const targetRoot = join(configDir, 'skills');
  await mkdir(targetRoot, { recursive: true });

  const skillDirs = await findImportableSkillDirs(skillPath);
  if (skillDirs.length === 0) {
    throw new Error('No SKILL.md files found in selected directory');
  }

  const imported: string[] = [];
  for (const dir of skillDirs) {
    const safeName = safeSkillDirectoryName(basename(dir));
    if (!safeName) {
      continue;
    }
    const dest = join(targetRoot, safeName);
    await rm(dest, { recursive: true, force: true });
    await cp(dir, dest, { recursive: true });
    imported.push(safeName);
  }

  if (imported.length === 0) {
    throw new Error('No valid skill directories imported');
  }

  return { skill_name: imported[0], skill_names: imported };
}

export async function deleteCcbWandingSkill(skillName: string): Promise<void> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    throw new Error('CCB-Wanding config directory not found');
  }

  const safeName = safeSkillDirectoryName(skillName);
  if (!safeName || safeName !== skillName) {
    throw new Error('Invalid CCB-Wanding skill name');
  }

  await rm(join(configDir, 'skills', safeName), { recursive: true, force: true });
}
