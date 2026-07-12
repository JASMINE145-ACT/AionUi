/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { syncEmployeeProfileHandoffToCcbConfig, syncEmployeeProfileToCcbConfig } from '@/common/config/ccbEmployeeProfileSession';
import type { EmployeeClientProfile, EmployeeOrgContext } from '@/common/config/employeeOrgContextShared';
import type { EmployeeProfile } from '@/common/config/employeeProfileShared';

export function initCcbEmployeeProfileBridge(): void {
  ipcBridge.ccbEmployeeProfileService.syncProfile.provider(
    async ({
      org,
      client,
      profile,
    }: {
      org?: EmployeeOrgContext | null;
      client?: EmployeeClientProfile | null;
      profile?: EmployeeProfile | null;
    }) => {
      if (org !== undefined || client !== undefined) {
        await syncEmployeeProfileHandoffToCcbConfig(org ?? null, client ?? null);
        return;
      }
      await syncEmployeeProfileToCcbConfig(profile ?? null);
    }
  );
}
