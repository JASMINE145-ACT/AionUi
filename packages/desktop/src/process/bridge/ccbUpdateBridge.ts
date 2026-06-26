/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * WanD CCB update IPC — About dual-track + spawn internal-upgrade.ps1.
 * Spec: claude-code-best/.trellis/spec/integration/internal-update.md §3.7
 */

import { ipcBridge } from '@/common';
import { isValidSha256Hex, verifyFileSha256 } from '@/common/update/internalUpdateSha256';
import type { CcbUpdateApplyResult, CcbUpdateCheckResult } from '@/common/update/updateTypes';
import { spawn } from 'node:child_process';
import { applySilentNsisInstall } from './silentNsisInstall';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildCcbUpdateCheckResult,
  DEFAULT_MANIFEST_URL_DEV,
  DEFAULT_MANIFEST_URL_STABLE,
  isInternalUpdateHost,
  parseInternalManifest,
  readCcbInstalledVersion,
  resolveCcbInstallDir,
  type CcbUpdateCheckResult as ManifestCcbCheckResult,
  type InternalUpdateArtifact,
} from './internalUpdateManifest';

const DEFAULT_USER_AGENT = 'AionUi';
const ALLOWED_DOWNLOAD_HOSTS = new Set<string>(['67.216.206.3', 'updates.yourcompany.com']);

type LastCheckState = {
  result: ManifestCcbCheckResult;
  channel: 'stable' | 'dev';
};

let lastCheck: LastCheckState | null = null;

function resolveManifestUrl(channel: 'stable' | 'dev'): string {
  if (channel === 'dev') {
    return process.env.AIONUI_UPDATE_MANIFEST_DEV_URL?.trim() || DEFAULT_MANIFEST_URL_DEV;
  }
  return process.env.CCB_UPDATE_MANIFEST_URL?.trim() || process.env.AIONUI_UPDATE_MANIFEST_URL?.trim() || DEFAULT_MANIFEST_URL_STABLE;
}

function assertAllowedArtifactUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid artifact URL');
  }
  if (parsed.protocol === 'http:' && isInternalUpdateHost(parsed.hostname)) {
    return;
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('HTTPS required');
  }
  if (!ALLOWED_DOWNLOAD_HOSTS.has(parsed.hostname)) {
    throw new Error(`Host not allowed: ${parsed.hostname}`);
  }
}

async function fetchManifest(channel: 'stable' | 'dev') {
  const manifestUrl = resolveManifestUrl(channel);
  assertAllowedArtifactUrl(manifestUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(manifestUrl, {
      headers: { Accept: 'application/json', 'User-Agent': DEFAULT_USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Manifest fetch failed (${res.status})`);
    }
    const json = (await res.json()) as unknown;
    const parsed = parseInternalManifest(json);
    if (!parsed) {
      throw new Error('Invalid unified manifest');
    }
    return parsed;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function downloadArtifact(artifact: InternalUpdateArtifact): Promise<string> {
  assertAllowedArtifactUrl(artifact.url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch(artifact.url, {
      headers: { 'User-Agent': DEFAULT_USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Download failed (${res.status})`);
    }
    if (!res.body) {
      throw new Error('Download body empty');
    }

    const fileName = path.basename(new URL(artifact.url).pathname) || 'ccb-update.bin';
    const target = path.join(os.tmpdir(), `ccb-update-${Date.now()}-${fileName}`);
    const fileStream = fs.createWriteStream(target);
    const reader = res.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        fileStream.write(Buffer.from(value));
      }
    }

    await new Promise<void>((resolve, reject) => {
      fileStream.end(() => resolve());
      fileStream.on('error', reject);
    });

    if (!isValidSha256Hex(artifact.sha256)) {
      throw new Error('Invalid sha256 in manifest');
    }
    const valid = await verifyFileSha256(target, artifact.sha256);
    if (!valid) {
      fs.rmSync(target, { force: true });
      throw new Error('SHA-256 checksum mismatch');
    }

    return target;
  } finally {
    clearTimeout(timeoutId);
  }
}

function spawnInternalUpgrade(
  installDir: string,
  zipPath: string,
  expectedVersion: string,
  expectedSha256: string
): Promise<void> {
  const powershell = path.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const script = path.join(installDir, 'scripts', 'internal-upgrade.ps1');

  return new Promise((resolve, reject) => {
    const child = spawn(
      powershell,
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        script,
        '-ZipPath',
        zipPath,
        '-ExpectedVersion',
        expectedVersion,
        '-ExpectedSha256',
        expectedSha256,
        '-InstallDir',
        installDir,
      ],
      { windowsHide: true }
    );

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`internal-upgrade.ps1 exited ${code ?? 'unknown'}`));
    });
  });
}

function findLatestBackup(_installDir: string, version: string): string | undefined {
  const backupRoot = path.join(process.env.LOCALAPPDATA || '', 'CCB-Wanding');
  if (!fs.existsSync(backupRoot)) {
    return undefined;
  }
  const prefix = `backup-before-${version}-`;
  const matches = fs
    .readdirSync(backupRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => path.join(backupRoot, entry.name))
    .toSorted((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return matches[0];
}

export function initCcbUpdateBridge(): void {
  ipcBridge.ccbUpdate.check.provider(async (params): Promise<{ success: boolean; data?: CcbUpdateCheckResult; msg?: string }> => {
    try {
      const channel = params?.channel === 'dev' ? 'dev' : 'stable';
      const manifest = await fetchManifest(channel);
      const result = buildCcbUpdateCheckResult(manifest);
      if (!result) {
        return {
          success: true,
          data: {
            installed: readCcbInstalledVersion(),
            latest: '',
            updateAvailable: false,
            fullInstaller: { url: '', sha256: '0'.repeat(64), size: 0 },
            mode: 'none',
          },
        };
      }
      lastCheck = { result, channel };
      return { success: true, data: result };
    } catch (err: unknown) {
      return { success: false, msg: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcBridge.ccbUpdate.getInstalledVersion.provider(async (): Promise<{ success: boolean; data?: { version: string | null }; msg?: string }> => {
    try {
      return { success: true, data: { version: readCcbInstalledVersion() } };
    } catch (err: unknown) {
      return { success: false, msg: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcBridge.ccbUpdate.apply.provider(async (): Promise<{ success: boolean; data?: CcbUpdateApplyResult; msg?: string }> => {
    try {
      if (!lastCheck?.result.updateAvailable) {
        return { success: false, msg: 'No pending CCB update. Run check first.' };
      }

      const check = lastCheck.result;
      const installDir = resolveCcbInstallDir();
      if (!installDir) {
        return { success: false, data: { success: false, error: 'install_dir' } };
      }

      if (check.mode === 'hot') {
        if (!check.hotUpdate) {
          return { success: false, data: { success: false, error: 'hot_missing' } };
        }
        const zipPath = await downloadArtifact(check.hotUpdate);
        try {
          await spawnInternalUpgrade(installDir, zipPath, check.latest, check.hotUpdate.sha256);
        } finally {
          try {
            fs.rmSync(zipPath, { force: true });
          } catch {
            // ignore
          }
        }
        const backupPath = findLatestBackup(installDir, check.latest);
        return {
          success: true,
          data: {
            success: true,
            version: check.latest,
            backupPath,
          },
        };
      }

      const fullArtifact = check.fullInstaller;
      const installerPath = await downloadArtifact(fullArtifact);
      applySilentNsisInstall(installerPath);
      return {
        success: true,
        data: {
          success: true,
          version: check.latest,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Host not allowed') || message.includes('host')) {
        return { success: false, data: { success: false, error: 'host' } };
      }
      if (message.includes('SHA-256')) {
        return { success: false, data: { success: false, error: 'sha256' } };
      }
      return { success: false, data: { success: false, error: message }, msg: message };
    }
  });
}
