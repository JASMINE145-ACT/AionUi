/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure helpers for "了解任务（Agent）" handoff — understand, not execute.
 */

import {
  CCB_DEFAULT_SESSION_AGENT_ID,
  CCB_WANDING_KEEP_AGENT_IDS,
  sortCcbAgents,
} from '@/common/config/ccbAgentCatalog';
import type { CcbAgentRecord } from '@/common/config/ccbAgents';
import type { WorkTask } from '@/common/types/workTasks/workTaskTypes';

export const WORK_TASK_AGENT_BRIEF_MARKER = '[Agent 了解]';

/** Claude ACP session mode for understand handoff — UI label「全自动」 */
export const WORK_TASK_UNDERSTAND_SESSION_MODE = 'bypassPermissions';

export type WorkTaskUnderstandPromptInput = {
  task: Pick<
    WorkTask,
    'id' | 'title' | 'description' | 'status' | 'assignee' | 'assignee_id' | 'created_by' | 'created_by_id' | 'due_at'
  >;
  agentId?: string;
};

export type WorkTaskAgentBriefPathInput = {
  conversationId: string;
  agentId: string;
  agentLabel?: string;
  at?: Date;
};

function formatDueAt(dueAt: number | undefined): string {
  if (!dueAt) return '—';
  try {
    return new Date(dueAt).toISOString();
  } catch {
    return String(dueAt);
  }
}

/** Build the auto-sent first user message for task-understand handoff. */
export function buildWorkTaskUnderstandPrompt(input: WorkTaskUnderstandPromptInput): string {
  const { task } = input;
  const assignee = task.assignee?.username ?? task.assignee_id ?? '—';
  const creator = task.created_by?.username ?? task.created_by_id ?? '—';
  const description = (task.description ?? '').trim() || '（无说明）';

  return [
    '请根据下面的工作任务做「了解」，不是执行。',
    '',
    '硬约束：',
    '1. 先用简体中文介绍：你对本任务的理解（一小段）。',
    '2. 判断任务类型（工作台待办 vs 需委派业务）以及是否建议委派哪个子 agent。',
    '3. 建议执行人下一步（含是否该接受），但默认不要调用 work_tasks_edit 改状态或改标题。',
    '4. 不要主动查价、做 Office、伪造完成，也不要擅自加码；用户未要求则只做了解与介绍。',
    '5. 系统已把会话路径写入任务说明时，无需重复写路径。',
    '',
    '【任务】',
    `ID: ${task.id}`,
    `标题: ${task.title}`,
    `状态: ${task.status}`,
    `执行人: ${assignee}`,
    `指派人: ${creator}`,
    `截止: ${formatDueAt(task.due_at)}`,
    '说明:',
    description,
  ].join('\n');
}

export function formatWorkTaskAgentBriefPath(input: WorkTaskAgentBriefPathInput): string {
  const at = input.at ?? new Date();
  const stamp = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')} ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  const label = (input.agentLabel ?? input.agentId).trim() || input.agentId;
  const shortId = input.conversationId.length > 12 ? input.conversationId.slice(0, 8) : input.conversationId;
  return `${WORK_TASK_AGENT_BRIEF_MARKER} ${stamp} · ${label} · 会话 ${shortId}`;
}

/** Append brief path to description; skip if same conversation id already recorded. */
export function appendWorkTaskAgentBriefPath(
  description: string | undefined | null,
  input: WorkTaskAgentBriefPathInput
): { description: string; appended: boolean } {
  const existing = description ?? '';
  if (existing.includes(input.conversationId) || existing.includes(input.conversationId.slice(0, 8))) {
    return { description: existing, appended: false };
  }
  const block = formatWorkTaskAgentBriefPath(input);
  const next = existing.trim() ? `${existing.trimEnd()}\n\n---\n${block}` : `---\n${block}`;
  return { description: next, appended: true };
}

export function resolveWorkTaskUnderstandDefaultAgentId(agentId?: string): string {
  const id = agentId?.trim();
  return id || CCB_DEFAULT_SESSION_AGENT_ID;
}

export function workTaskUnderstandAgentLabel(
  agent: Pick<CcbAgentRecord, 'id' | 'name' | 'display_name'>,
  mainAgentFallback = '主入口'
): string {
  if (agent.id === CCB_DEFAULT_SESSION_AGENT_ID) {
    return agent.display_name?.trim() || mainAgentFallback;
  }
  return agent.display_name?.trim() || agent.name || agent.id;
}

/** Keep-set agents for the understand picker; main entry first. */
export function listWorkTaskUnderstandAgentOptions(agents: CcbAgentRecord[]): CcbAgentRecord[] {
  const enabled = agents.filter((a) => a.enabled !== false && CCB_WANDING_KEEP_AGENT_IDS.has(a.id));
  const sorted = sortCcbAgents(enabled);
  const main = sorted.find((a) => a.id === CCB_DEFAULT_SESSION_AGENT_ID);
  const rest = sorted.filter((a) => a.id !== CCB_DEFAULT_SESSION_AGENT_ID);
  if (main) return [main, ...rest];
  const fallbackMain: CcbAgentRecord = {
    id: CCB_DEFAULT_SESSION_AGENT_ID,
    name: CCB_DEFAULT_SESSION_AGENT_ID,
    display_name: '主入口',
    schema_version: 1,
    enabled: true,
    recommended_prompts: [],
    mcp_allowlist: [],
    skills: { enabled: [], disabled: [] },
    source: 'bundled',
    created_at: '',
    updated_at: '',
  };
  return [fallbackMain, ...rest];
}
