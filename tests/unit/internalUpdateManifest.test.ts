/**
 * @vitest-environment node
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import * as internalUpdateManifest from '@/process/bridge/internalUpdateManifest';

const {
  buildUpdateCheckFromManifest,
  compareCcbVersions,
  isCcbVersionNewer,
  isInternalUpdateEnabled,
  mapInternalRelease,
  parseCcbBlock,
  parseInternalManifest,
  resolveCcbUpdateMode,
} = internalUpdateManifest;

const FIXTURE = {
  schema_version: 1,
  channel: 'stable',
  published_at: '2026-06-19T12:00:00+08:00',
  aionui: {
    version: '2.1.18-wanding.1',
    install_mode: 'standalone',
    artifact: {
      url: 'http://67.216.206.3/updates/aionui/AionUi-2.1.18-wanding.1-win-x64.exe',
      sha256: 'a'.repeat(64),
      size: 100,
      release_notes: 'test notes',
    },
  },
  ccb: {
    version: '1.0.4',
    release_notes: 'ccb notes',
    hot_update: {
      min_from_version: '1.0.0',
      artifact: {
        url: 'http://67.216.206.3/updates/ccb/CCB-dist-1.0.4-win-x64.zip',
        sha256: 'b'.repeat(64),
        size: 200,
      },
    },
    full_installer: {
      url: 'http://67.216.206.3/updates/ccb/CCB-Wanding-1.0.4.exe',
      sha256: 'c'.repeat(64),
      size: 300,
    },
  },
};

describe('internalUpdateManifest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parseInternalManifest accepts schema v1', () => {
    const parsed = parseInternalManifest(FIXTURE);
    expect(parsed?.aionui?.version).toBe('2.1.18-wanding.1');
    expect(parsed?.aionui?.artifact.sha256).toHaveLength(64);
  });

  it('rejects invalid schema', () => {
    expect(parseInternalManifest({ schema_version: 2 })).toBeNull();
    expect(parseInternalManifest(null)).toBeNull();
  });

  it('rejects empty or invalid artifact sha256', () => {
    const emptySha = { ...FIXTURE, aionui: { ...FIXTURE.aionui, artifact: { ...FIXTURE.aionui.artifact, sha256: '' } } };
    expect(parseInternalManifest(emptySha)?.aionui).toBeNull();

    const badSha = { ...FIXTURE, aionui: { ...FIXTURE.aionui, artifact: { ...FIXTURE.aionui.artifact, sha256: 'not-hex' } } };
    expect(parseInternalManifest(badSha)?.aionui).toBeNull();
  });

  it('buildUpdateCheckFromManifest detects newer version', () => {
    const parsed = parseInternalManifest(FIXTURE)!;
    const result = buildUpdateCheckFromManifest(parsed, '2.1.17');
    expect(result.updateAvailable).toBe(true);
    expect(result.latest?.recommendedAsset?.sha256).toBe('a'.repeat(64));
    expect(result.latest?.recommendedAsset?.url).toContain('67.216.206.3');
  });

  it('buildUpdateCheckFromManifest up-to-date', () => {
    const parsed = parseInternalManifest(FIXTURE)!;
    const result = buildUpdateCheckFromManifest(parsed, '2.1.18-wanding.1');
    expect(result.updateAvailable).toBe(false);
  });

  it('isInternalUpdateEnabled respects opt-out', () => {
    const prevGithub = process.env.AIONUI_USE_GITHUB_UPDATE;
    const prevInternal = process.env.AIONUI_USE_INTERNAL_UPDATE;
    try {
      process.env.AIONUI_USE_GITHUB_UPDATE = '1';
      expect(isInternalUpdateEnabled()).toBe(false);
      delete process.env.AIONUI_USE_GITHUB_UPDATE;
      process.env.AIONUI_USE_INTERNAL_UPDATE = '0';
      expect(isInternalUpdateEnabled()).toBe(false);
    } finally {
      if (prevGithub === undefined) delete process.env.AIONUI_USE_GITHUB_UPDATE;
      else process.env.AIONUI_USE_GITHUB_UPDATE = prevGithub;
      if (prevInternal === undefined) delete process.env.AIONUI_USE_INTERNAL_UPDATE;
      else process.env.AIONUI_USE_INTERNAL_UPDATE = prevInternal;
    }
  });

  it('parseCcbBlock accepts unified ccb block', () => {
    const parsed = parseCcbBlock(FIXTURE.ccb);
    expect(parsed?.version).toBe('1.0.4');
    expect(parsed?.hot_update?.artifact.sha256).toHaveLength(64);
    expect(parsed?.full_installer.url).toContain('CCB-Wanding');
  });

  it('parseCcbBlock rejects malformed block', () => {
    expect(parseCcbBlock(null)).toBeNull();
    expect(parseCcbBlock({ version: '1.0.0' })).toBeNull();
  });

  it('resolveCcbUpdateMode handles out-of-range and up-to-date', () => {
    const ccb = parseCcbBlock(FIXTURE.ccb)!;
    expect(resolveCcbUpdateMode(null, ccb)).toBe('full');
    expect(resolveCcbUpdateMode('1.0.4', ccb)).toBe('none');
  });

  it('readCcbInstalledVersion reads VERSION from an explicit install dir', () => {
    const installDir = mkdtempSync(join(tmpdir(), 'ccb-version-read-'));
    const distDir = join(installDir, 'dist');
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, 'VERSION'), '1.0.0\n', 'utf8');

    expect(internalUpdateManifest.readCcbInstalledVersion(installDir)).toBe('1.0.0');
  });

  it('buildCcbUpdateCheckResult uses manifest version when installed version is older', () => {
    const installDir = mkdtempSync(join(tmpdir(), 'ccb-update-check-'));
    const distDir = join(installDir, 'dist');
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, 'VERSION'), '1.0.0\n', 'utf8');

    const installed = internalUpdateManifest.readCcbInstalledVersion(installDir);
    const manifest = parseInternalManifest(FIXTURE)!;
    const mode = resolveCcbUpdateMode(installed, manifest.ccb!);

    expect(manifest.ccb?.version).toBe('1.0.4');
    expect(mode).not.toBe('none');
    expect(mode === 'hot' || mode === 'full').toBe(true);
  });

  it('mapInternalRelease uses bundled full_installer artifact', () => {
    const bundled = parseInternalManifest({
      ...FIXTURE,
      aionui: { ...FIXTURE.aionui, install_mode: 'bundled' },
    })!;
    const release = mapInternalRelease(bundled);
    expect(release?.recommendedAsset?.url).toContain('CCB-Wanding-1.0.4.exe');
  });

  it('compareCcbVersions orders 4-part Windows patch versions', () => {
    expect(isCcbVersionNewer('1.1.3.1', '1.1.3')).toBe(true);
    expect(isCcbVersionNewer('1.1.3', '1.1.3.1')).toBe(false);
    expect(compareCcbVersions('1.1.3.1', '1.1.3')).toBe(1);
  });

  it('resolveCcbUpdateMode treats 1.1.3.1 as newer than 1.1.3', () => {
    const ccb = parseCcbBlock({
      version: '1.1.3.1',
      hot_update: {
        min_from_version: '1.1.1',
        artifact: {
          url: 'http://67.216.206.3/updates/ccb/CCB-dist-1.1.3.1-win-x64.zip',
          sha256: 'b'.repeat(64),
          size: 200,
        },
      },
      full_installer: {
        url: 'http://67.216.206.3/updates/ccb/CCB-Wanding-1.1.2.exe',
        sha256: 'c'.repeat(64),
        size: 300,
      },
    })!;
    expect(resolveCcbUpdateMode('1.1.3', ccb)).not.toBe('none');
    expect(resolveCcbUpdateMode('1.1.3.1', ccb)).toBe('none');
  });
});
