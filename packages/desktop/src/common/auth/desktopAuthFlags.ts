/**
 * Desktop auth flags injected by preload from main-process env.
 * Spec: .trellis/spec/integration/aioncore-work-tasks.md
 */

type DesktopAuthWindow = Window & {
  __bypassAuth?: boolean;
  __forceRelogin?: boolean;
};

export function isDesktopBypassAuth(): boolean {
  if (typeof window === 'undefined') {
    return process.env.AIONUI_BYPASS_AUTH === '1';
  }
  return Boolean((window as DesktopAuthWindow).__bypassAuth);
}

export function shouldForceRelogin(): boolean {
  if (typeof window === 'undefined') {
    return process.env.AIONUI_FORCE_RELOGIN === '1';
  }
  return Boolean((window as DesktopAuthWindow).__forceRelogin);
}

export function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean((window as Window & { electronAPI?: unknown }).electronAPI);
}
