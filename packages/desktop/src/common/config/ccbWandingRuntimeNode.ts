/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Main-process-only helpers (uses node:fs). Do not import from renderer.
 */

import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
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

/** Resolve CCB-Wanding CLI used for MCP manifest probes. */
export function resolveCcbWandingCliPath(): string | null {
  const fromEnv = process.env.CCB_WANDING_CLI ?? process.env.CCB_WANDING_CLI_PATH;
  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv;
  }

  const candidates: string[] = [];
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    candidates.push(join(process.env.LOCALAPPDATA, 'CCB-Wanding', 'dist', 'cli-bun.js'));
    candidates.push(join(process.env.LOCALAPPDATA, 'CCB-Wanding', 'dist', 'cli.js'));
    candidates.push('D:\\CCB-Wanding\\dist\\cli-bun.js');
    candidates.push('D:\\CCB-Wanding\\dist\\cli.js');
  }
  candidates.push(join(homedir(), 'CCB-Wanding', 'dist', 'cli-bun.js'));
  candidates.push(join(homedir(), 'CCB-Wanding', 'dist', 'cli.js'));
  candidates.push(join(homedir(), '.ccb-wanding', 'dist', 'cli.js'));

  for (const candidate of candidates) {
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
