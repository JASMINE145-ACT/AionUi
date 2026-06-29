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

export function isCcbStartupSendAllowed(readiness: CcbStartupReadinessStatus): boolean {
  if (readiness.phase === 'ready') return true;
  if (readiness.phase === 'error' && readiness.config_ok) return readiness.soft_ready;
  return false;
}
