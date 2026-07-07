import { ipcBridge } from '@/common';
import { configService } from '@/common/config/configService';
import { normalizeEmployeeProfile } from '@/common/config/employeeProfileShared';
import { isElectronDesktop } from '@/renderer/utils/platform';

/** Sync saved employee profile to CCB config dir before session/new. */
export async function stageEmployeeProfileForSession(): Promise<void> {
  if (!isElectronDesktop()) {
    return;
  }
  await configService.whenReady();
  const profile = normalizeEmployeeProfile(configService.get('user.employeeProfile'));
  try {
    await ipcBridge.ccbEmployeeProfileService.syncProfile.invoke({ profile });
  } catch (error) {
    console.warn('[stageEmployeeProfileForSession] syncProfile failed:', error);
  }
}
