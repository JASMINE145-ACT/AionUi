/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * B0.1 — Delegation spawn observability contract (frontend mirror).
 *
 * Maps AGENT.INSTRUCTIONS.001 tiers to fields AionUI can verify from ACP tool events
 * after CCB runAgent spawn — no prompt injection here (that stays in runAgent.ts / L1).
 *
 * | Tier      | CCB source (authoritative)     | UI observability signal              |
 * |-----------|--------------------------------|--------------------------------------|
 * | stable    | L1 agent .md body at spawn     | subagent_type on Agent row           |
 * | dynamic   | mergeEmployeeProfile, output   | agentId + tool_uses in Agent output  |
 * | ephemeral | orchestrator handoff prompt    | Agent input / turn user message      |
 */

import type { DelegationRun } from './delegationRun';
import { buildDelegationRuns } from './delegationRun';
import type { DecompositionPlan } from './decompositionPlan';
import { syncPlanWithDelegationRuns } from './decompositionPlan';
import type { NormalizedToolCall } from './normalizeToolCall';

export type SpawnContextTier = 'stable' | 'dynamic' | 'ephemeral';

export type ChildLinkMode = 'explicit-parent' | 'sequential-fallback' | 'orphan-mismatch' | 'none';

export type SpawnContextField = {
  tier: SpawnContextTier;
  key: string;
  present: boolean;
  value?: string | number;
};

export type DelegationSpawnObservabilityReport = {
  parentToolUseId: string;
  healthy: boolean;
  issues: string[];
  fields: SpawnContextField[];
  childLinkMode: ChildLinkMode;
};

export type TurnDelegationSpawnAssessment = {
  runs: DelegationSpawnObservabilityReport[];
  guidDirect: boolean;
  allHealthy: boolean;
};

const detectChildLinkMode = (run: DelegationRun, allTools: NormalizedToolCall[]): ChildLinkMode => {
  if (run.children.length === 0) {
    return run.childToolCount > 0 && run.status === 'done' ? 'orphan-mismatch' : 'none';
  }

  const childKeys = new Set(run.children.map((child) => child.key));
  const explicitLinks = allTools.filter(
    (tool) =>
      childKeys.has(tool.key) &&
      tool.parentToolUseId?.trim() === run.parentToolUseId,
  );

  if (explicitLinks.length > 0) return 'explicit-parent';
  if (run.children.length > 0) return 'sequential-fallback';
  return 'none';
};

export function assessDelegationSpawnObservability(
  run: DelegationRun,
  allTools: NormalizedToolCall[],
): DelegationSpawnObservabilityReport {
  const issues: string[] = [];
  const fields: SpawnContextField[] = [];

  const stableType = run.subagentType.trim();
  fields.push({
    tier: 'stable',
    key: 'subagent_type',
    present: Boolean(stableType && stableType !== 'subagent'),
    value: stableType || undefined,
  });
  if (!fields[0]?.present && run.displayLabel === '子 Agent') {
    issues.push('stable: subagent_type missing — using fallback display label');
  }

  fields.push({
    tier: 'dynamic',
    key: 'childAgentId',
    present: Boolean(run.childAgentId?.trim()),
    value: run.childAgentId,
  });
  fields.push({
    tier: 'dynamic',
    key: 'childToolCount',
    present: run.childToolCount > 0,
    value: run.childToolCount,
  });
  if (run.status === 'done' && !run.childAgentId?.trim()) {
    issues.push('dynamic: agentId missing on completed Agent output');
  }

  const ephemeralPrompt = run.agentTool.input?.trim();
  fields.push({
    tier: 'ephemeral',
    key: 'delegation_prompt',
    present: Boolean(ephemeralPrompt),
    value: ephemeralPrompt ? '(present)' : undefined,
  });

  const childLinkMode = detectChildLinkMode(run, allTools);
  if (childLinkMode === 'orphan-mismatch') {
    issues.push('dynamic: tool_uses > 0 but no nested child tools visible in UI grouper');
  }
  if (childLinkMode === 'none' && run.status === 'running') {
    issues.push('ephemeral: delegation running but no child tools yet');
  }

  const isBenignIssue = (issue: string): boolean =>
    issue.startsWith('stable: subagent_type missing') ||
    issue.startsWith('ephemeral: delegation running') ||
    issue.startsWith('dynamic: agentId missing');

  const healthy = issues.length === 0 || issues.every(isBenignIssue);

  return {
    parentToolUseId: run.parentToolUseId,
    healthy,
    issues,
    fields,
    childLinkMode,
  };
}

export function isGuidDirectTurn(tools: NormalizedToolCall[]): boolean {
  const runs = buildDelegationRuns(tools);
  const hasAgentParent = tools.some((tool) => tool.isAgentDelegation);
  return runs.length === 0 && !hasAgentParent && tools.length > 0;
}

export function assessTurnDelegationSpawn(tools: NormalizedToolCall[]): TurnDelegationSpawnAssessment {
  const runs = buildDelegationRuns(tools);
  const reports = runs.map((run) => assessDelegationSpawnObservability(run, tools));
  const guidDirect = isGuidDirectTurn(tools);

  return {
    runs: reports,
    guidDirect,
    allHealthy: reports.every((report) => report.healthy),
  };
}

/** Consumer-plane: link B0 DelegationRuns onto a DecompositionPlan for View Steps timeline. */
export function syncTurnPlanWithTools(
  plan: DecompositionPlan,
  tools: NormalizedToolCall[],
): DecompositionPlan {
  return syncPlanWithDelegationRuns(plan, buildDelegationRuns(tools));
}

/** Path A smoke fixture — default orchestrator 查直接50 (2026-07-07 user smoke). */
export const PATH_A_ORCHESTRATOR_SMOKE_TOOLS: NormalizedToolCall[] = [
  {
    key: 'agent-parent-smoke',
    name: 'Agent',
    status: 'completed',
    isAgentDelegation: true,
    subagentLabel: 'quotation-agent',
    output: JSON.stringify({ agentId: 'a7bef2f70cb5d93da', tool_uses: 2 }),
  },
  {
    key: 'read-smoke',
    name: 'Read D:\\CCB-Wanding\\vendor\\wanding\\data\\wanding_business_knowledge.md',
    status: 'completed',
  },
  {
    key: 'mcp-smoke',
    name: 'mcp__quotation__match_quotation execute',
    status: 'completed',
  },
];
