/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getAgentDelegationLabel, parseSubagentTypeFromDisplayName } from './agentToolCallUtils';
import { groupNormalizedToolCalls } from './groupNormalizedToolCalls';
import type { NormalizedToolCall } from './normalizeToolCall';

export type DelegationRunStatus = 'running' | 'done' | 'blocked';

export type DelegationRun = {
  parentToolUseId: string;
  subagentType: string;
  displayLabel: string;
  childAgentId?: string;
  childToolCount: number;
  completedChildCount: number;
  status: DelegationRunStatus;
  children: NormalizedToolCall[];
  agentTool: NormalizedToolCall;
};

const WANDE_AGENT_DISPLAY_NAMES: Record<string, string> = {
  'quotation-agent': '万鼎报价专家',
  'accurate-agent': '万鼎账务专家',
  'research-agent': '调研专家',
  'word-creator': 'Word 文档助手',
  'ppt-creator': 'PPT 演示助手',
  'excel-creator': 'Excel 表格助手',
  'price-library-agent': '价格库管理',
};

export type BuildDelegationRunsOptions = {
  resolveDisplayName?: (subagentType: string) => string | undefined;
};

export function resolveDelegationDisplayLabel(
  subagentType: string,
  resolver?: (subagentType: string) => string | undefined,
): string {
  const trimmed = subagentType.trim();
  const fromResolver = resolver?.(trimmed)?.trim();
  if (fromResolver) return fromResolver;
  return WANDE_AGENT_DISPLAY_NAMES[trimmed] ?? trimmed;
}

export function parseAgentOutputMeta(output?: string): { agentId?: string; toolUses?: number } {
  if (!output?.trim()) return {};
  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;
    const agentId = typeof parsed.agentId === 'string' ? parsed.agentId : undefined;
    const toolUses = typeof parsed.tool_uses === 'number' ? parsed.tool_uses : undefined;
    return { agentId, toolUses };
  } catch {
    const agentIdMatch = output.match(/agentId["\s:]+([a-zA-Z0-9_-]+)/i);
    return agentIdMatch?.[1] ? { agentId: agentIdMatch[1] } : {};
  }
}

const countCompletedChildren = (children: NormalizedToolCall[]): number =>
  children.filter((child) => child.status === 'completed').length;

const deriveRunStatus = (agent: NormalizedToolCall, children: NormalizedToolCall[]): DelegationRunStatus => {
  if (agent.status === 'error' || agent.status === 'canceled') {
    return 'blocked';
  }

  const anyRunning =
    agent.status === 'running' ||
    agent.status === 'pending' ||
    children.some((child) => child.status === 'running' || child.status === 'pending');

  if (anyRunning) {
    return 'running';
  }

  if (children.some((child) => child.status === 'error')) {
    return 'blocked';
  }

  return 'done';
};

export function formatDelegationHeader(run: DelegationRun): string {
  const statusLabel = run.status;
  const progress =
    run.status === 'running' && run.childToolCount > 0
      ? `${run.completedChildCount}/${run.childToolCount} tools`
      : `${run.childToolCount} tools`;
  return `委派 → ${run.displayLabel} · ${statusLabel} · ${progress}`;
};

export function buildDelegationRuns(
  tools: NormalizedToolCall[],
  options?: BuildDelegationRunsOptions,
): DelegationRun[] {
  const { topLevel, childrenByParent } = groupNormalizedToolCalls(tools);
  const runs: DelegationRun[] = [];

  for (const agent of topLevel) {
    if (!agent.isAgentDelegation) continue;

    const explicitType =
      agent.subagentLabel?.trim() || parseSubagentTypeFromDisplayName(agent.name);
    const helperLabel = explicitType ? '' : getAgentDelegationLabel(undefined, agent.name);
    const subagentType =
      explicitType ||
      (helperLabel && helperLabel !== 'Subagent' && helperLabel !== 'Agent' ? helperLabel : '');
    const displayLabel = subagentType
      ? resolveDelegationDisplayLabel(subagentType, options?.resolveDisplayName)
      : '子 Agent';

    const children = childrenByParent.get(agent.key) ?? [];
    const outputMeta = parseAgentOutputMeta(agent.output);
    const isTerminal =
      agent.status === 'completed' || agent.status === 'error' || agent.status === 'canceled';
    const childToolCount =
      isTerminal && outputMeta.toolUses !== undefined
        ? Math.max(outputMeta.toolUses, children.length)
        : Math.max(children.length, outputMeta.toolUses ?? 0);

    runs.push({
      parentToolUseId: agent.key,
      subagentType: subagentType || 'subagent',
      displayLabel,
      childAgentId: outputMeta.agentId,
      childToolCount,
      completedChildCount: countCompletedChildren(children),
      status: deriveRunStatus(agent, children),
      children,
      agentTool: agent,
    });
  }

  return runs;
}

/** Top-level tools that are not Agent delegation headers (Guid-direct flat steps, etc.). */
export function getOrphanTopLevelTools(tools: NormalizedToolCall[]): NormalizedToolCall[] {
  const { topLevel } = groupNormalizedToolCalls(tools);
  return topLevel.filter((item) => !item.isAgentDelegation);
}

export function findDelegationRunForParent(
  tools: NormalizedToolCall[],
  parentToolUseId: string,
  options?: BuildDelegationRunsOptions,
): DelegationRun | undefined {
  return buildDelegationRuns(tools, options).find((run) => run.parentToolUseId === parentToolUseId);
}
