/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * WanD center manifest feed — parse unified manifest.json for AionUI About → check update.
 * Spec: claude-code-best/.trellis/spec/integration/internal-update.md
 */

import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import semver from 'semver';

import type { GitHubReleaseAsset, UpdateCheckResult, UpdateReleaseInfo } from '@/common/update/updateTypes';
import { isValidSha256Hex } from '@/common/update/internalUpdateSha256';

export const INTERNAL_UPDATE_HOSTS = new Set(['67.216.206.3', 'updates.yourcompany.com']);

export const DEFAULT_MANIFEST_URL_STABLE =
  process.env.AIONUI_UPDATE_MANIFEST_URL?.trim() || 'http://67.216.206.3/updates/manifest.json';

export const DEFAULT_MANIFEST_URL_DEV =
  process.env.AIONUI_UPDATE_MANIFEST_DEV_URL?.trim() || 'http://67.216.206.3/updates/manifest-dev.json';

export type InternalUpdateArtifact = {
  url: string;
  sha256: string;
  size: number;
  release_notes?: string;
};

export type InternalUpdateManifest = {
  schema_version: number;
  channel: 'stable' | 'dev';
  published_at: string;
  aionui: {
    version: string;
    install_mode: 'standalone' | 'bundled';
    min_ccb_version?: string;
    artifact: InternalUpdateArtifact;
  } | null;
  ccb?: CcbBlock | null;
};

export type CcbBlock = {
  version: string;
  release_notes?: string;
  hot_update?: {
    min_from_version: string;
    artifact: InternalUpdateArtifact;
  };
  full_installer: InternalUpdateArtifact;
};

export type CcbUpdateMode = 'hot' | 'full' | 'none';

export type CcbUpdateCheckResult = {
  installed: string | null;
  latest: string;
  updateAvailable: boolean;
  hotUpdate?: InternalUpdateArtifact;
  fullInstaller: InternalUpdateArtifact;
  mode: CcbUpdateMode;
};

export type CcbUpdateApplyResult = {
  success: boolean;
  backupPath?: string;
  version?: string;
  error?: string;
};

function parseArtifactBlock(raw: unknown): InternalUpdateArtifact | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const artifact = raw as Record<string, unknown>;
  if (
    typeof artifact.url !== 'string' ||
    typeof artifact.sha256 !== 'string' ||
    typeof artifact.size !== 'number' ||
    !isValidSha256Hex(artifact.sha256)
  ) {
    return null;
  }
  return {
    url: artifact.url,
    sha256: artifact.sha256.toLowerCase(),
    size: artifact.size,
    release_notes: typeof artifact.release_notes === 'string' ? artifact.release_notes : undefined,
  };
}

export function parseCcbBlock(raw: unknown): CcbBlock | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const block = raw as Record<string, unknown>;
  if (typeof block.version !== 'string') {
    return null;
  }
  const fullInstaller = parseArtifactBlock(block.full_installer);
  if (!fullInstaller) {
    return null;
  }

  let hotUpdate: CcbBlock['hot_update'];
  if (block.hot_update && typeof block.hot_update === 'object') {
    const hot = block.hot_update as Record<string, unknown>;
    const hotArtifact = parseArtifactBlock(hot.artifact);
    if (typeof hot.min_from_version === 'string' && hotArtifact) {
      hotUpdate = {
        min_from_version: hot.min_from_version,
        artifact: hotArtifact,
      };
    }
  }

  return {
    version: block.version,
    release_notes: typeof block.release_notes === 'string' ? block.release_notes : undefined,
    hot_update: hotUpdate,
    full_installer: fullInstaller,
  };
}

export function resolveCcbInstallDir(): string | null {
  const envHome = process.env.CCB_WANDING_HOME?.trim();
  if (envHome && fs.existsSync(path.join(envHome, 'dist'))) {
    return envHome;
  }

  const localApp = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'CCB-Wanding');
  if (fs.existsSync(path.join(localApp, 'dist'))) {
    return localApp;
  }

  let dir = process.resourcesPath;
  if (dir) {
    for (let i = 0; i < 5; i++) {
      const distDir = path.join(dir, 'dist');
      const upgradeScript = path.join(dir, 'scripts', 'internal-upgrade.ps1');
      if (fs.existsSync(distDir) && fs.existsSync(upgradeScript)) {
        return dir;
      }
      const parent = path.dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
  }

  return null;
}

export function readCcbInstalledVersion(installDir?: string | null): string | null {
  const dir = installDir ?? resolveCcbInstallDir();
  if (dir) {
    const versionFile = path.join(dir, 'dist', 'VERSION');
    if (fs.existsSync(versionFile)) {
      const version = fs.readFileSync(versionFile, 'utf8').trim();
      if (version) {
        return version;
      }
    }
  }

  if (process.platform === 'win32') {
    try {
      const out = execFileSync('reg', ['query', 'HKCU\\Software\\CCB-Wanding\\CCB-Wanding', '/v', 'Version'], {
        encoding: 'utf8',
      });
      const match = out.match(/Version\s+REG_SZ\s+(\S+)/i);
      if (match?.[1]) {
        return match[1].trim();
      }
    } catch {
      // ignore missing registry key
    }
  }

  return null;
}

/** Windows-style dotted versions (e.g. 1.1.3.1). npm semver coerces 1.1.3.1 → 1.1.3 — do not use semver for CCB. */
export function compareCcbVersions(a: string, b: string): number {
  const pa = a.trim().split('.').map((part) => {
    const n = parseInt(part, 10);
    return Number.isFinite(n) ? n : 0;
  });
  const pb = b.trim().split('.').map((part) => {
    const n = parseInt(part, 10);
    return Number.isFinite(n) ? n : 0;
  });
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) {
      return d > 0 ? 1 : -1;
    }
  }
  return 0;
}

export function isCcbVersionNewer(candidate: string, installed: string): boolean {
  return compareCcbVersions(candidate, installed) > 0;
}

export function isCcbVersionAtLeast(installed: string, minimum: string): boolean {
  return compareCcbVersions(installed, minimum) >= 0;
}

export function resolveCcbUpdateMode(installed: string | null, ccb: CcbBlock): CcbUpdateMode {
  const latest = ccb.version.trim();
  if (!latest) {
    return 'none';
  }
  if (installed && !isCcbVersionNewer(latest, installed)) {
    return 'none';
  }

  const installDir = resolveCcbInstallDir();
  if (!installed || !installDir || !fs.existsSync(path.join(installDir, 'dist'))) {
    return 'full';
  }

  const hot = ccb.hot_update;
  if (hot?.artifact) {
    const min = hot.min_from_version.trim();
    if (min && isCcbVersionAtLeast(installed, min)) {
      return 'hot';
    }
  }

  return 'full';
}

export function buildCcbUpdateCheckResult(manifest: InternalUpdateManifest): CcbUpdateCheckResult | null {
  const ccb = manifest.ccb;
  if (!ccb) {
    return null;
  }

  const installed = readCcbInstalledVersion();
  const mode = resolveCcbUpdateMode(installed, ccb);
  const updateAvailable = mode !== 'none';

  return {
    installed,
    latest: ccb.version.trim(),
    updateAvailable,
    hotUpdate: ccb.hot_update?.artifact,
    fullInstaller: ccb.full_installer,
    mode,
  };
}

export function isInternalUpdateEnabled(): boolean {
  if (process.env.AIONUI_USE_GITHUB_UPDATE === '1') {
    return false;
  }
  if (process.env.AIONUI_USE_INTERNAL_UPDATE === '0') {
    return false;
  }
  return true;
}

export function resolveManifestUrl(includePrerelease: boolean): string {
  return includePrerelease ? DEFAULT_MANIFEST_URL_DEV : DEFAULT_MANIFEST_URL_STABLE;
}

export function isInternalUpdateHost(hostname: string): boolean {
  return INTERNAL_UPDATE_HOSTS.has(hostname);
}

export function parseInternalManifest(raw: unknown): InternalUpdateManifest | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const m = raw as Record<string, unknown>;
  if (m.schema_version !== 1) {
    return null;
  }
  if (m.channel !== 'stable' && m.channel !== 'dev') {
    return null;
  }
  if (typeof m.published_at !== 'string') {
    return null;
  }

  let aionui: InternalUpdateManifest['aionui'] = null;
  if (m.aionui && typeof m.aionui === 'object') {
    const block = m.aionui as Record<string, unknown>;
    const artifact = block.artifact as Record<string, unknown> | undefined;
    if (
      typeof block.version === 'string' &&
      (block.install_mode === 'standalone' || block.install_mode === 'bundled') &&
      artifact &&
      typeof artifact.url === 'string' &&
      typeof artifact.sha256 === 'string' &&
      isValidSha256Hex(artifact.sha256) &&
      typeof artifact.size === 'number'
    ) {
      aionui = {
        version: block.version,
        install_mode: block.install_mode,
        min_ccb_version: typeof block.min_ccb_version === 'string' ? block.min_ccb_version : undefined,
        artifact: {
          url: artifact.url,
          sha256: artifact.sha256.toLowerCase(),
          size: artifact.size,
          release_notes: typeof artifact.release_notes === 'string' ? artifact.release_notes : undefined,
        },
      };
    }
  }

  return {
    schema_version: 1,
    channel: m.channel,
    published_at: m.published_at,
    aionui,
    ccb: parseCcbBlock(m.ccb),
  };
}

export function mapInternalRelease(manifest: InternalUpdateManifest): UpdateReleaseInfo | null {
  const block = manifest.aionui;
  if (!block) {
    return null;
  }

  let artifact = block.artifact;
  if (block.install_mode === 'bundled' && manifest.ccb?.full_installer) {
    artifact = manifest.ccb.full_installer;
  }
  const version = semver.valid(block.version) || semver.coerce(block.version)?.version;
  if (!version) {
    return null;
  }

  const fileName = path.basename(new URL(artifact.url).pathname) || `AionUi-${version}-win-x64.exe`;
  const asset: GitHubReleaseAsset = {
    name: fileName,
    url: artifact.url,
    size: artifact.size,
    sha256: artifact.sha256,
  };

  return {
    tagName: `v${version}`,
    version,
    name: `AionUi ${version}`,
    body: artifact.release_notes ?? block.artifact.release_notes ?? '',
    htmlUrl: artifact.url,
    publishedAt: manifest.published_at,
    prerelease: manifest.channel === 'dev',
    draft: false,
    assets: [asset],
    recommendedAsset: asset,
  };
}

export function buildUpdateCheckFromManifest(
  manifest: InternalUpdateManifest,
  currentVersion: string
): UpdateCheckResult {
  const currentSemver = semver.valid(currentVersion) || semver.coerce(currentVersion)?.version;
  const latest = mapInternalRelease(manifest);

  if (!currentSemver || !latest) {
    return { currentVersion, updateAvailable: false };
  }

  return {
    currentVersion,
    updateAvailable: semver.gt(latest.version, currentSemver),
    latest,
  };
}
