/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { isWebUiBrowserMode } from '@/common/adapter/httpBridge';
import { ccbModelService, ccbSkillsService, fs } from '@/common/adapter/ipcBridge';
import { fetchWebUiCcbAuthority } from '@/common/webui/ccbWebApi';
import type { CcbSkillInfo } from '@/common/config/ccbSkillsShared';

export type SettingsSkillInfo = {
  name: string;
  description: string;
  location: string;
  relative_location?: string;
  is_custom: boolean;
  source?: 'builtin' | 'custom' | 'extension' | 'ccb-wanding';
};

export type SettingsSkillPaths = {
  user_skills_dir: string;
  builtin_skills_dir: string;
};

export type SettingsSkillsCatalog = {
  skills: SettingsSkillInfo[];
  paths: SettingsSkillPaths;
  builtinAutoSkills: Array<{ name: string; description: string }>;
  source: 'ccb' | 'aionui';
};

function mapCcbSkillToSettings(skill: CcbSkillInfo): SettingsSkillInfo {
  return {
    name: skill.name,
    description: skill.description,
    location: skill.location,
    relative_location: skill.relative_location,
    is_custom: skill.is_custom,
    source: skill.source ?? 'ccb-wanding',
  };
}

async function fetchCcbSettingsSkillsCatalog(): Promise<Omit<SettingsSkillsCatalog, 'source'>> {
  await ccbSkillsService.syncFromAionUi.invoke().catch((error) => {
    console.warn('[fetchSkillsCatalog] CCB skill sync from AionUI failed:', error);
  });
  const [skills, paths] = await Promise.all([
    ccbSkillsService.listSkills.invoke(),
    ccbSkillsService.getPaths.invoke(),
  ]);
  return {
    skills: skills
      .filter((skill) => skill.status !== 'invalid' && skill.status !== 'missing')
      .map(mapCcbSkillToSettings)
      .sort((left, right) => left.name.localeCompare(right.name)),
    paths,
    builtinAutoSkills: [],
  };
}

async function fetchUpstreamSettingsSkillsCatalog(): Promise<Omit<SettingsSkillsCatalog, 'source'>> {
  const [skills, paths, autoSkills] = await Promise.all([
    fs.listAvailableSkills.invoke(),
    fs.getSkillPaths.invoke(),
    fs.listBuiltinAutoSkills.invoke(),
  ]);
  return {
    skills,
    paths,
    builtinAutoSkills: autoSkills,
  };
}

/** Settings → 技能 hub catalog — CCB `.claude/skills` when authority active, else upstream AionUI corpus. */
export async function fetchSettingsSkillsCatalog(): Promise<SettingsSkillsCatalog> {
  const ccbAuthorityActive = isWebUiBrowserMode()
    ? await fetchWebUiCcbAuthority().catch(() => false)
    : await ccbModelService.isAuthorityActive.invoke().catch(() => false);
  if (ccbAuthorityActive && !isWebUiBrowserMode()) {
    const catalog = await fetchCcbSettingsSkillsCatalog();
    return { ...catalog, source: 'ccb' };
  }
  const catalog = await fetchUpstreamSettingsSkillsCatalog();
  return { ...catalog, source: 'aionui' };
}
