/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import {
  deleteCcbWandingSkill,
  getCcbSkillPaths,
  importSkillToCcbWanding,
  listCcbWandingSkills,
  syncAionUiCorpusSkillsToCcbWanding,
} from '@/common/config/ccbSkills';

export function initCcbSkillsBridge(): void {
  ipcBridge.ccbSkillsService.listSkills.provider(async () => listCcbWandingSkills());

  ipcBridge.ccbSkillsService.getPaths.provider(async () => getCcbSkillPaths());

  ipcBridge.ccbSkillsService.importSkill.provider(async ({ skillPath }) =>
    importSkillToCcbWanding(skillPath)
  );

  ipcBridge.ccbSkillsService.deleteSkill.provider(async ({ skillName }) => {
    await deleteCcbWandingSkill(skillName);
  });

  ipcBridge.ccbSkillsService.syncFromAionUi.provider(async () => syncAionUiCorpusSkillsToCcbWanding());
}
