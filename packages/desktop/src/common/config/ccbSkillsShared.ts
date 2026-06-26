/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Browser/renderer-safe CCB-Wanding skills types (no node:fs).
 */

export type CcbSkillInfo = {
  name: string;
  description: string;
  location: string;
  relative_location?: string;
  is_custom: boolean;
  source?: 'ccb-wanding' | 'builtin' | 'custom' | 'extension';
  status?: 'ready' | 'missing' | 'invalid';
};

export type CcbSkillPaths = {
  user_skills_dir: string;
  builtin_skills_dir: string;
};

export type CcbSkillImportResult = {
  skill_name: string;
  skill_names?: string[];
};
