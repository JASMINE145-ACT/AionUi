/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Renderer-safe MCP health types and pure report helpers.
 * Keep Node-only logic in ccbMcpHealth.ts (main process).
 */

import type { CcbMcpHealthDiagnosis } from './ccbMcpHealthDiagnosis';

export type CcbMcpHealthItem = {
  layer: 'config' | 'files' | 'agents' | 'probe' | 'session' | 'optional';
  id: string;
  ok: boolean;
  detail: string;
  /** When true, failure does not block report.ok or diagnosis */
  warn?: boolean;
};

export type CcbMcpHealthLayerResult = {
  ok: boolean;
  items: CcbMcpHealthItem[];
};

export type CcbMcpHealthReport = {
  ok: boolean;
  checked_at: string;
  /** MCP registration + quotation.env checks */
  config: CcbMcpHealthLayerResult;
  /** Vendor install tree paths (when install dir resolved) */
  files?: CcbMcpHealthLayerResult;
  /** Agent seeds + sidecar mcp_allowlist */
  agents?: CcbMcpHealthLayerResult;
  probe?: CcbMcpHealthLayerResult;
  session?: CcbMcpHealthLayerResult;
  /** exa HTTP probe + ppt-master skill paths — WARN only, never blocks core health */
  optional?: CcbMcpHealthLayerResult;
  diagnosis?: CcbMcpHealthDiagnosis;
};

export type CcbMcpHealthRepairResult = {
  ok: boolean;
  steps: Array<{ id: string; ok: boolean; detail: string }>;
};

export function collectCcbMcpHealthFailedItems(report: CcbMcpHealthReport): CcbMcpHealthItem[] {
  return [
    ...report.config.items,
    ...(report.files?.items ?? []),
    ...(report.agents?.items ?? []),
    ...(report.probe?.items ?? []),
    ...(report.session?.items ?? []),
    ...(report.optional?.items ?? []),
  ].filter((item) => !item.ok && !item.warn);
}

export function collectCcbMcpHealthWarnItems(report: CcbMcpHealthReport): CcbMcpHealthItem[] {
  return (report.optional?.items ?? []).filter((item) => !item.ok && item.warn);
}
