/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Persist employee profile handoff for CCB-Wanding ACP session/new (read on each session).
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CCB_EMPLOYEE_PROFILE_FILE } from './employeeProfileShared';
import {
  buildEmployeeProfileHandoff,
  normalizeEmployeeClientProfile,
  type EmployeeClientProfile,
  type EmployeeOrgContext,
  type EmployeeProfileHandoff,
} from './employeeOrgContextShared';
import { resolveCcbClaudeConfigDir } from './ccbWandingRuntime';

export async function syncEmployeeProfileHandoffToCcbConfig(
  org: EmployeeOrgContext | null | undefined,
  client: EmployeeClientProfile | null | undefined
): Promise<void> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir) {
    return;
  }

  const normalizedClient = normalizeEmployeeClientProfile(client ?? undefined);
  const handoff = buildEmployeeProfileHandoff(org ?? null, normalizedClient);
  const payload: EmployeeProfileHandoff = handoff ?? { cleared_at: new Date().toISOString() };
  await writeFile(join(configDir, CCB_EMPLOYEE_PROFILE_FILE), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

/** @deprecated Use syncEmployeeProfileHandoffToCcbConfig — kept for bridge signature compat during transition. */
export async function syncEmployeeProfileToCcbConfig(
  profile: import('./employeeProfileShared').EmployeeProfile | null | undefined
): Promise<void> {
  const client = normalizeEmployeeClientProfile({
    addressName: profile?.addressName,
    email: profile?.email,
    phone: profile?.phone,
    notes: profile?.notes,
    updatedAt: profile?.updatedAt,
  });
  await syncEmployeeProfileHandoffToCcbConfig(null, client);
}
