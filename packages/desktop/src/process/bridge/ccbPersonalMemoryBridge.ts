/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import {
  isValidMemoryScope,
  listMemoryFiles,
  readMemoryFile,
  writeMemoryFile,
} from '@/common/config/ccbMemoryFiles';
import { readPersonalMemoryLearningStatus } from '@/common/config/ccbPersonalMemoryLearning';

export function initCcbPersonalMemoryBridge(): void {
  ipcBridge.ccbPersonalMemoryService.getLearningStatus.provider(async () => {
    return readPersonalMemoryLearningStatus();
  });

  ipcBridge.ccbPersonalMemoryService.listFiles.provider(async ({ scope }) => {
    if (!isValidMemoryScope(scope)) return [];
    return listMemoryFiles(scope);
  });

  ipcBridge.ccbPersonalMemoryService.readFile.provider(async ({ relPath }) => {
    return readMemoryFile(relPath);
  });

  ipcBridge.ccbPersonalMemoryService.writeFile.provider(async ({ relPath, content }) => {
    return writeMemoryFile(relPath, content);
  });
}
