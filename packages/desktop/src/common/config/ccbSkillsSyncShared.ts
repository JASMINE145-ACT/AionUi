/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Browser/renderer-safe helpers for AionUI → CCB-Wanding skill sync.
 */

export type AionUiCorpusSkillRecord = {
  name: string;
  location: string;
};

export type CcbSkillSyncResult = {
  copied: string[];
  refreshed: string[];
  skipped_existing: string[];
  skipped_missing: string[];
  errors: string[];
};

export const AIONUI_MANAGED_SKILL_MARKER = '.aionui-sync-origin';

export function mergeAionUiCorpusSkillRecords(
  autoSkills: ReadonlyArray<{ name?: string; location?: string }>,
  availableSkills: ReadonlyArray<{ name?: string; location?: string; source?: string }>
): AionUiCorpusSkillRecord[] {
  const byName = new Map<string, AionUiCorpusSkillRecord>();

  for (const skill of autoSkills) {
    if (!skill.name?.trim() || !skill.location?.trim()) {
      continue;
    }
    byName.set(skill.name, { name: skill.name, location: skill.location });
  }

  for (const skill of availableSkills) {
    if (!skill.name?.trim() || !skill.location?.trim()) {
      continue;
    }
    if (skill.source !== 'builtin') {
      continue;
    }
    if (!byName.has(skill.name)) {
      byName.set(skill.name, { name: skill.name, location: skill.location });
    }
  }

  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
}
