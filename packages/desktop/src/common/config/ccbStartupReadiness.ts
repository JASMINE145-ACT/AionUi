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
import {
  isCcbStartupCoreMcpOk,
  mergeWarmResultsOnTimeout,
  parseWarmWandingMcpStdout,
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
export {
  isCcbStartupCoreMcpOk,
  isCcbStartupSendAllowed,
  isCcbStartupSoftReadyWarning,
  mergeWarmResultsOnTimeout,
  parseWarmWandingMcpStdout,
} from './ccbStartupReadinessShared';

/** Quotation alone — gates soft_ready (Guid send path). */
const CORE_WARM_TIMEOUT_MS = 90_000;
/** Accurate is best-effort; must not force soft_ready if quotation already OK. */
const BEST_EFFORT_WARM_TIMEOUT_MS = 60_000;

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
  const timeoutMs = options.timeoutMs ?? CORE_WARM_TIMEOUT_MS;
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
      // Keep PASS/FAIL already printed — do not wipe with a single timeout row.
      finish(
        mergeWarmResultsOnTimeout(
          stdout,
          servers,
          timeoutMs,
          `MCP warm exceeded ${Math.round(timeoutMs / 1000)}s`
        )
      );
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (settled) return;
      const results = parseWarmWandingMcpStdout(stdout);
      if (results.length === 0) {
        finish([
          {
            server: 'warm-script',
            ok: code === 0,
            ms: Date.now() - started,
            detail: stderr.trim() || stdout.trim() || `exit ${code ?? 'unknown'}`,
          },
        ]);
        return;
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

    // Quotation first (gates soft_ready). Resolve pipeline as soon as core is OK so
    // ensureStartupReadiness / initial ACP send are not held by accurate best-effort warm.
    const quotationResults = await spawnWarmScript(['quotation'], { timeoutMs: CORE_WARM_TIMEOUT_MS });
    const coreOk = isCcbStartupCoreMcpOk(quotationResults);
    const coreFailed = quotationResults.filter((r) => !r.ok);

    if (coreOk) {
      const coreReady: CcbStartupReadinessStatus = {
        phase: 'ready',
        config_ok: true,
        mcp_ok: true,
        soft_ready: false,
        error: undefined,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        mcp_results: quotationResults,
      };
      setStatus(coreReady);
      // Accurate continues in background; update mcp_results when done (no soft_ready).
      void spawnWarmScript(['accurate'], { timeoutMs: BEST_EFFORT_WARM_TIMEOUT_MS }).then((accurateResults) => {
        const latest = getCcbStartupReadinessStatus();
        if (latest.phase !== 'ready' || !latest.mcp_ok) return;
        setStatus({
          ...latest,
          finished_at: new Date().toISOString(),
          mcp_results: [...quotationResults, ...accurateResults],
        });
      });
      return coreReady;
    }

    // Core failed — still try accurate (best-effort telemetry) then soft_ready.
    const accurateResults = await spawnWarmScript(['accurate'], { timeoutMs: BEST_EFFORT_WARM_TIMEOUT_MS });
    const mcpResults = [...quotationResults, ...accurateResults];
    const finished: CcbStartupReadinessStatus = {
      phase: 'ready',
      config_ok: true,
      mcp_ok: false,
      soft_ready: true,
      error: coreFailed.map((r) => `${r.server}: ${r.detail}`).join('; ') || 'quotation warm failed',
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

/** Clear cached ready/error so ensure can re-run (Guid banner retry). */
export function resetCcbStartupReadinessForRetry(): void {
  resetCcbStartupReadinessForTests();
}

export async function retryCcbStartupReadiness(): Promise<CcbStartupReadinessStatus> {
  resetCcbStartupReadinessForRetry();
  return ensureCcbStartupReadiness();
}
