/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { syncEmployeeProfileToCcbConfig } from '@/common/config/ccbEmployeeProfileSession';
import type { EmployeeProfile } from '@/common/config/employeeProfileShared';

export function initCcbEmployeeProfileBridge(): void {
  ipcBridge.ccbEmployeeProfileService.syncProfile.provider(async ({ profile }: { profile: EmployeeProfile | null }) => {
    await syncEmployeeProfileToCcbConfig(profile);
  });
}
