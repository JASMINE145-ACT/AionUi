/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Renderer-safe types + helpers for CCB startup readiness (no Node imports).
 */

export type CcbStartupReadinessPhase = 'idle' | 'config' | 'mcp_warm' | 'ready' | 'error';

export type CcbStartupMcpWarmResult = {
  server: string;
  ok: boolean;
  ms: number;
  detail: string;
};

export type CcbStartupReadinessStatus = {
  phase: CcbStartupReadinessPhase;
  config_ok: boolean;
  mcp_ok: boolean;
  soft_ready: boolean;
  error?: string;
  started_at?: string;
  finished_at?: string;
  mcp_results?: CcbStartupMcpWarmResult[];
};

/** Core warm set that gates soft_ready scare banner (accurate is best-effort). */
export const CCB_STARTUP_CORE_WARM_SERVERS = ['quotation'] as const;

const WARM_LINE_RE = /^\[warm-wanding-mcp\] (PASS|FAIL) (\S+) (\d+)ms (.*)$/;

/** Parse warm-wanding-mcp.mjs stdout lines into per-server results. */
export function parseWarmWandingMcpStdout(stdout: string): CcbStartupMcpWarmResult[] {
  const results: CcbStartupMcpWarmResult[] = [];
  for (const line of String(stdout || '').split(/\r?\n/)) {
    const match = line.match(WARM_LINE_RE);
    if (!match) continue;
    results.push({
      server: match[2],
      ok: match[1] === 'PASS',
      ms: Number(match[3]),
      detail: match[4],
    });
  }
  return results;
}

/**
 * On outer kill/timeout: keep already-printed PASS/FAIL lines; mark only missing
 * intended servers as timed out (do not replace everything with a single timeout row).
 */
export function mergeWarmResultsOnTimeout(
  stdout: string,
  intendedServers: readonly string[],
  timeoutMs: number,
  detail = 'MCP warm exceeded budget'
): CcbStartupMcpWarmResult[] {
  const parsed = parseWarmWandingMcpStdout(stdout);
  const seen = new Set(parsed.map((r) => r.server));
  const merged = [...parsed];
  for (const server of intendedServers) {
    if (seen.has(server)) continue;
    merged.push({
      server,
      ok: false,
      ms: timeoutMs,
      detail,
    });
  }
  if (merged.length === 0) {
    merged.push({
      server: 'timeout',
      ok: false,
      ms: timeoutMs,
      detail,
    });
  }
  return merged;
}

/**
 * mcp_ok when every core server PASSed.
 * If the warm layer only returned synthetic rows (timeout / warm-script), require all ok.
 */
export function isCcbStartupCoreMcpOk(results: readonly CcbStartupMcpWarmResult[] | undefined): boolean {
  if (!results || results.length === 0) return false;
  const core = results.filter((r) =>
    (CCB_STARTUP_CORE_WARM_SERVERS as readonly string[]).includes(r.server)
  );
  if (core.length === 0) {
    return results.every((r) => r.ok);
  }
  return core.every((r) => r.ok);
}

export function isCcbStartupSendAllowed(readiness: CcbStartupReadinessStatus): boolean {
  if (readiness.phase === 'ready') return true;
  if (readiness.phase === 'error' && readiness.config_ok) return readiness.soft_ready;
  return false;
}

/** Show the soft-ready warning when core warm failed (send still allowed). */
export function isCcbStartupSoftReadyWarning(readiness: CcbStartupReadinessStatus): boolean {
  return readiness.phase === 'ready' && readiness.soft_ready && !readiness.mcp_ok;
}
