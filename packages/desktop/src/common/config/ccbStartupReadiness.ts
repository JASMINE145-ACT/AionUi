/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * App-startup readiness pipeline for CCB-Wanding (Layer 1 config + Layer 2 MCP warm).
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { collectCcbMcpHealthFailedItems, runCcbMcpHealthCheck } from './ccbMcpHealth';
import type {
  CcbStartupMcpWarmResult,
  CcbStartupReadinessPhase,
  CcbStartupReadinessStatus,
} from './ccbStartupReadinessShared';
import { resolveCcbClaudeConfigDir } from './ccbWandingRuntime';
import {
  isCcbMcpAuthorityActive,
  resolveCcbInstallerRoot,
  resolveCcbWandingInstallDir,
} from './ccbWandingRuntimeNode';

export type {
  CcbStartupMcpWarmResult,
  CcbStartupReadinessPhase,
  CcbStartupReadinessStatus,
} from './ccbStartupReadinessShared';
export { isCcbStartupSendAllowed } from './ccbStartupReadinessShared';

const MCP_WARM_TIMEOUT_MS = 120_000;
const DEFAULT_WARM_SERVERS = ['quotation', 'accurate'] as const;

let status: CcbStartupReadinessStatus = {
  phase: 'idle',
  config_ok: false,
  mcp_ok: false,
  soft_ready: false,
};

let pipelinePromise: Promise<CcbStartupReadinessStatus> | null = null;

export function getCcbStartupReadinessStatus(): CcbStartupReadinessStatus {
  return { ...status, mcp_results: status.mcp_results ? [...status.mcp_results] : undefined };
}

function setStatus(next: CcbStartupReadinessStatus): void {
  status = next;
}

function spawnWarmScript(
  servers: readonly string[],
  options: { timeoutMs?: number } = {}
): Promise<CcbStartupMcpWarmResult[]> {
  const timeoutMs = options.timeoutMs ?? MCP_WARM_TIMEOUT_MS;
  const installerRoot = resolveCcbInstallerRoot();
  const installDir = resolveCcbWandingInstallDir();
  const configDir = resolveCcbClaudeConfigDir();
  const script =
    installerRoot && existsSync(join(installerRoot, 'lib', 'warm-wanding-mcp.mjs'))
      ? join(installerRoot, 'lib', 'warm-wanding-mcp.mjs')
      : installDir && existsSync(join(installDir, 'lib', 'warm-wanding-mcp.mjs'))
        ? join(installDir, 'lib', 'warm-wanding-mcp.mjs')
        : null;

  if (!script) {
    return Promise.resolve([
      {
        server: 'warm-script',
        ok: false,
        ms: 0,
        detail: 'warm-wanding-mcp.mjs not found',
      },
    ]);
  }

  return new Promise((resolve) => {
    const child = spawn('node', [script, `--servers=${servers.join(',')}`], {
      env: {
        ...process.env,
        ...(installDir ? { CCB_INSTALL_DIR: installDir } : {}),
        ...(configDir ? { CLAUDE_CONFIG_DIR: configDir } : {}),
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let settled = false;
    let stdout = '';
    let stderr = '';
    const started = Date.now();

    const finish = (results: CcbStartupMcpWarmResult[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill();
      } catch {
        // ignore
      }
      resolve(results);
    };

    const timer = setTimeout(() => {
      finish([
        {
          server: 'timeout',
          ok: false,
          ms: timeoutMs,
          detail: 'MCP warm exceeded 120s',
        },
      ]);
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      const results: CcbStartupMcpWarmResult[] = [];
      for (const line of stdout.split(/\r?\n/)) {
        const match = line.match(/^\[warm-wanding-mcp\] (PASS|FAIL) (\S+) (\d+)ms (.*)$/);
        if (match) {
          results.push({
            server: match[2],
            ok: match[1] === 'PASS',
            ms: Number(match[3]),
            detail: match[4],
          });
        }
      }
      if (results.length === 0) {
        results.push({
          server: 'warm-script',
          ok: code === 0,
          ms: Date.now() - started,
          detail: stderr.trim() || stdout.trim() || `exit ${code ?? 'unknown'}`,
        });
      }
      finish(results);
    });
  });
}

async function runPipeline(): Promise<CcbStartupReadinessStatus> {
  const startedAt = new Date().toISOString();
  setStatus({
    phase: 'config',
    config_ok: false,
    mcp_ok: false,
    soft_ready: false,
    started_at: startedAt,
  });

  if (!(await isCcbMcpAuthorityActive())) {
    const finished: CcbStartupReadinessStatus = {
      phase: 'ready',
      config_ok: true,
      mcp_ok: true,
      soft_ready: false,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    };
    setStatus(finished);
    return finished;
  }

  try {
    const configReport = await runCcbMcpHealthCheck({ probe: false });
    if (!configReport.ok) {
      const failed = collectCcbMcpHealthFailedItems(configReport).map((i) => i.id);
      const finished: CcbStartupReadinessStatus = {
        phase: 'error',
        config_ok: false,
        mcp_ok: false,
        soft_ready: false,
        error: `config check failed: ${failed.join(', ') || 'unknown'}`,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      };
      setStatus(finished);
      return finished;
    }

    setStatus({
      ...getCcbStartupReadinessStatus(),
      phase: 'mcp_warm',
      config_ok: true,
    });

    const mcpResults = await spawnWarmScript(DEFAULT_WARM_SERVERS, { timeoutMs: MCP_WARM_TIMEOUT_MS });
    const mcpOk = mcpResults.every((r) => r.ok);
    const timedOut = mcpResults.some((r) => r.server === 'timeout');

    const finished: CcbStartupReadinessStatus = {
      phase: 'ready',
      config_ok: true,
      mcp_ok: mcpOk,
      soft_ready: timedOut || !mcpOk,
      error: mcpOk ? undefined : mcpResults.map((r) => `${r.server}: ${r.detail}`).join('; '),
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      mcp_results: mcpResults,
    };
    setStatus(finished);
    return finished;
  } catch (error) {
    const finished: CcbStartupReadinessStatus = {
      phase: 'error',
      config_ok: false,
      mcp_ok: false,
      soft_ready: false,
      error: error instanceof Error ? error.message : String(error),
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    };
    setStatus(finished);
    return finished;
  }
}

export async function ensureCcbStartupReadiness(): Promise<CcbStartupReadinessStatus> {
  if (status.phase === 'ready' || status.phase === 'error') {
    return getCcbStartupReadinessStatus();
  }
  if (!pipelinePromise) {
    pipelinePromise = runPipeline().finally(() => {
      pipelinePromise = null;
    });
  }
  return pipelinePromise;
}

export function startCcbStartupReadinessPipeline(): void {
  void ensureCcbStartupReadiness();
}

export function resetCcbStartupReadinessForTests(): void {
  status = {
    phase: 'idle',
    config_ok: false,
    mcp_ok: false,
    soft_ready: false,
  };
  pipelinePromise = null;
}
