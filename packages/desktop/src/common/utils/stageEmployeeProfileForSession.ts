import { ipcBridge } from '@/common';
import { configService } from '@/common/config/configService';
import {
  normalizeEmployeeClientProfile,
  type EmployeeClientProfile,
} from '@/common/config/employeeOrgContextShared';
import { fetchEmployeeOrgContext } from '@/common/config/fetchEmployeeOrgContext';
import { isElectronDesktop } from '@/renderer/utils/platform';

function readClientProfileFromSettings(): EmployeeClientProfile | null {
  const stored = configService.get('user.employeeProfile');
  if (!stored || typeof stored !== 'object') return null;
  return normalizeEmployeeClientProfile({
    addressName: stored.addressName,
    email: stored.email,
    phone: stored.phone,
    notes: stored.notes,
    updatedAt: stored.updatedAt,
  });
}

/** Sync org context + client supplement to CCB config dir before session/new. */
export async function stageEmployeeProfileForSession(): Promise<void> {
  if (!isElectronDesktop()) {
    return;
  }
  await configService.whenReady();
  const org = await fetchEmployeeOrgContext();
  const client = readClientProfileFromSettings();
  try {
    await ipcBridge.ccbEmployeeProfileService.syncProfile.invoke({ org, client });
  } catch (error) {
    console.warn('[stageEmployeeProfileForSession] syncProfile failed:', error);
  }
}
