/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import useSWR from 'swr';
import { ipcBridge } from '@/common';
import { isOrgServerConfigured } from '@/common/adapter/orgHttpBridge';
import type {
  CreateOrgUserParams,
  DeleteOrgUserParams,
  ResetOrgUserPasswordParams,
  UpdateOrgUserParams,
} from '@/common/types/orgUsers/orgUserTypes';

export function useOrgUsersList(enabled: boolean) {
  const key = enabled && isOrgServerConfigured() ? 'org-users.list' : null;
  return useSWR(key, () => ipcBridge.orgUsers.list.invoke());
}

export async function createOrgUser(params: CreateOrgUserParams) {
  return ipcBridge.orgUsers.create.invoke(params);
}

export async function updateOrgUser(params: UpdateOrgUserParams) {
  return ipcBridge.orgUsers.update.invoke(params);
}

export async function deleteOrgUser(params: DeleteOrgUserParams) {
  return ipcBridge.orgUsers.delete.invoke(params);
}

export async function resetOrgUserPassword(params: ResetOrgUserPasswordParams) {
  return ipcBridge.orgUsers.resetPassword.invoke(params);
}
