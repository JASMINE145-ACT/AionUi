/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Persist employee profile for CCB-Wanding ACP session/new (read on each session).
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CCB_EMPLOYEE_PROFILE_FILE,
  normalizeEmployeeProfile,
  type EmployeeProfile,
} from './employeeProfileShared';
import { resolveCcbClaudeConfigDir } from './ccbWandingRuntime';

export async function syncEmployeeProfileToCcbConfig(profile: EmployeeProfile | null | undefined): Promise<void> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir) {
    return;
  }

  const normalized = normalizeEmployeeProfile(profile);
  const payload = normalized ?? { cleared_at: new Date().toISOString() };
  await writeFile(join(configDir, CCB_EMPLOYEE_PROFILE_FILE), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}
