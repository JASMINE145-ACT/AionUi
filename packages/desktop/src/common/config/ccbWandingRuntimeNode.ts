/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Main-process-only helpers (uses node:fs). Do not import from renderer.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { resolveCcbClaudeConfigDir } from './ccbWandingRuntime';

export function isCcbWandingInstallPresent(configDir = resolveCcbClaudeConfigDir()): boolean {
  if (!configDir) {
    return false;
  }
  return existsSync(join(configDir, 'settings.json'));
}

/** When true, MCP settings page reads/writes CCB-Wanding settings.json (not aioncore DB). */
export function isCcbMcpAuthorityActive(): boolean {
  return isCcbWandingInstallPresent();
}

/**
 * HKCU InstallDir written by NSIS (`Software\CCB-Wanding\CCB-Wanding`).
 * Best-effort — returns null if reg.exe fails or value missing.
 */
export function readCcbWandingRegistryInstallDir(): string | null {
  if (process.platform !== 'win32') {
    return null;
  }
  try {
    const out = execFileSync(
      'reg',
      ['query', 'HKCU\\Software\\CCB-Wanding\\CCB-Wanding', '/v', 'InstallDir'],
      { encoding: 'utf8', windowsHide: true, timeout: 5000 },
    );
    const match = out.match(/InstallDir\s+REG_SZ\s+(.+)/i);
    const value = match?.[1]?.trim();
    return value || null;
  } catch {
    return null;
  }
}

function pushCliUnderInstallRoot(candidates: string[], installRoot: string | null | undefined): void {
  if (!installRoot) return;
  const root = installRoot.trim().replace(/[\\/]+$/, '');
  if (!root) return;
  candidates.push(join(root, 'dist', 'cli-bun.js'));
  candidates.push(join(root, 'dist', 'cli.js'));
}

/**
 * Ordered CLI path candidates for CCB-Wanding.
 * Official Programs tree + NSIS registry must beat legacy residue paths
 * (`%LOCALAPPDATA%\CCB-Wanding`, `D:\CCB-Wanding`) — otherwise continuity/MCP health
 * attach to incomplete leftovers after a proper Programs install.
 *
 * Exported for unit tests (order contract).
 */
export function listCcbWandingCliCandidates(): string[] {
  const candidates: string[] = [];

  const fromEnv = process.env.CCB_WANDING_CLI ?? process.env.CCB_WANDING_CLI_PATH;
  if (fromEnv) {
    candidates.push(fromEnv);
  }

  const fromInstallEnv = process.env.CCB_WANDING_INSTALL_DIR ?? process.env.CCB_INSTALL_DIR;
  pushCliUnderInstallRoot(candidates, fromInstallEnv);

  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    pushCliUnderInstallRoot(candidates, readCcbWandingRegistryInstallDir());
    // Official overlay install root (NSIS default InstallDir)
    pushCliUnderInstallRoot(candidates, join(process.env.LOCALAPPDATA, 'Programs', 'CCB-Wanding'));
    // Legacy / residue trees (after purge these should be gone; keep as last resort)
    pushCliUnderInstallRoot(candidates, join(process.env.LOCALAPPDATA, 'CCB-Wanding'));
    pushCliUnderInstallRoot(candidates, 'D:\\CCB-Wanding');
    pushCliUnderInstallRoot(candidates, 'C:\\CCB-Wanding');
    pushCliUnderInstallRoot(candidates, 'E:\\CCB-Wanding');
  }

  pushCliUnderInstallRoot(candidates, join(homedir(), 'CCB-Wanding'));
  candidates.push(join(homedir(), '.ccb-wanding', 'dist', 'cli.js'));

  // de-dupe preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const c of candidates) {
    const key = c.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }
  return unique;
}

/** Resolve CCB-Wanding CLI used for MCP manifest probes. */
export function resolveCcbWandingCliPath(): string | null {
  for (const candidate of listCcbWandingCliCandidates()) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/** Resolve CCB-Wanding install root (parent of dist/). */
export function resolveCcbWandingInstallDir(): string | null {
  const cli = resolveCcbWandingCliPath();
  if (!cli) {
    return null;
  }
  const distDir = dirname(cli);
  if (basename(distDir) === 'dist') {
    return dirname(distDir);
  }
  return distDir;
}

/** Resolve ccb-installer repo root (scripts + seed agents). */
export function resolveCcbInstallerRoot(): string | null {
  const fromEnv = process.env.CCB_INSTALLER_ROOT;
  if (fromEnv && existsSync(join(fromEnv, 'scripts', 'deploy-seed-agents.mjs'))) {
    return fromEnv;
  }

  const candidates = [
    'D:\\Projects\\claude-code-best\\ccb-installer',
    join(homedir(), 'Projects', 'claude-code-best', 'ccb-installer'),
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'scripts', 'deploy-seed-agents.mjs'))) {
      return candidate;
    }
  }
  return null;
}
