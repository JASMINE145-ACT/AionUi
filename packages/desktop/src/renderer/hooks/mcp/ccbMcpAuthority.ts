import { ccbMcpService } from '@/common/adapter/ipcBridge';

let cachedAuthority: boolean | undefined;

export async function isCcbMcpAuthorityActive(): Promise<boolean> {
  if (cachedAuthority === undefined) {
    cachedAuthority = await ccbMcpService.isAuthorityActive.invoke();
  }
  return cachedAuthority;
}

export function resetCcbMcpAuthorityCache(): void {
  cachedAuthority = undefined;
}
