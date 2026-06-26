/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * WanD NSIS silent install — spawn detached /S then quit app to release file locks.
 * Spec: claude-code-best/.trellis/spec/integration/internal-update.md §3.3, §3.7
 */

import { app } from 'electron';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const DEFAULT_QUIT_DELAY_MS = 800;

export function launchDetachedSilentNsisInstall(installerPath: string): void {
  if (!fs.existsSync(installerPath)) {
    throw new Error(`Installer not found: ${installerPath}`);
  }

  const child = spawn(installerPath, ['/S'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

export function scheduleAppQuitAfterSilentInstall(delayMs = DEFAULT_QUIT_DELAY_MS): void {
  setTimeout(() => {
    app.quit();
  }, delayMs);
}

/** Detached NSIS /S, then quit Electron so the installer can replace AionUi files. */
export function applySilentNsisInstall(installerPath: string, quitDelayMs = DEFAULT_QUIT_DELAY_MS): void {
  launchDetachedSilentNsisInstall(installerPath);
  scheduleAppQuitAfterSilentInstall(quitDelayMs);
}
