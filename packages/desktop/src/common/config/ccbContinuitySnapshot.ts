/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Main-process reader for CCB continuity snapshot. Do not import from renderer.
 */

import { createHash, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CcbContinuitySnapshot } from './ccbContinuitySnapshotShared';
import { resolveCcbClaudeConfigDir } from './ccbWandingRuntime';
import { isCcbWandingInstallPresent, resolveCcbWandingInstallDir } from './ccbWandingRuntimeNode';

function readJsonGeneration(path: string): number {
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as { config_generation?: unknown };
    const gen = Number(parsed.config_generation);
    if (!Number.isFinite(gen) || gen < 0) return 0;
    return Math.floor(gen);
  } catch {
    return 0;
  }
}

function readInstalledVersion(installDir: string): string | null {
  try {
    const versionPath = join(installDir, 'dist', 'VERSION');
    const trimmed = readFileSync(versionPath, 'utf8').trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

function readKnowledgeContentHash(installDir: string): string {
  const kbPath = join(installDir, 'vendor', 'wanding', 'data', 'wanding_business_knowledge.md');
  try {
    const bytes = readFileSync(kbPath);
    return createHash('sha256').update(bytes).digest('hex');
  } catch {
    return '';
  }
}

export function readCcbContinuitySnapshot(appVersion: string): CcbContinuitySnapshot | null {
  if (!isCcbWandingInstallPresent()) {
    return null;
  }

  const installDir = resolveCcbWandingInstallDir();
  const configDir = resolveCcbClaudeConfigDir();
  if (!installDir || !configDir) {
    return null;
  }

  const shipManifestPath = join(installDir, 'seed', 'config-ship-manifest.json');
  const userGenPath = join(configDir, '.config-generation.json');

  return {
    ship_config_generation: readJsonGeneration(shipManifestPath),
    user_config_generation: readJsonGeneration(userGenPath),
    installed_version: readInstalledVersion(installDir),
    app_version: appVersion.trim() || 'unknown',
    kb_content_hash: readKnowledgeContentHash(installDir),
  };
}
