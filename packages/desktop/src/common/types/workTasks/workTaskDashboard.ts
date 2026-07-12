/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkTask } from '@/common/types/workTasks/workTaskTypes';
import { isWorkTaskOverdue } from '@/common/types/workTasks/workTaskTypes';

/** MVP cap for client-side dashboard grouping (see dashboard-data-contract.md). */
export const WORK_TASK_DASHBOARD_ITEMS_CAP = 200;

/** Overdue list display limit on manager dashboard. */
export const WORK_TASK_DASHBOARD_OVERDUE_LIMIT = 10;

export type WorkTaskAssigneeGroup = {
  assignee_id: string | null;
  username: string;
  total: number;
  pending_accept: number;
  accepted: number;
  overdue_count: number;
};

export type WorkTaskDashboardSlice = {
  items: WorkTask[];
  truncated: boolean;
  totalBeforeCap: number;
};

export function capWorkTasksForDashboard(
  items: WorkTask[],
  cap: number = WORK_TASK_DASHBOARD_ITEMS_CAP
): WorkTaskDashboardSlice {
  const list = Array.isArray(items) ? items : [];
  return {
    items: list.slice(0, cap),
    truncated: list.length > cap,
    totalBeforeCap: list.length,
  };
}

/**
 * Group tasks by assignee for manager dashboard.
 * Null / missing assignee → assignee_id null, username fallback key `unassigned`.
 */
export function groupWorkTasksByAssignee(
  items: WorkTask[],
  unassignedLabel = 'unassigned'
): WorkTaskAssigneeGroup[] {
  const map = new Map<string, WorkTaskAssigneeGroup>();

  for (const task of items) {
    const assignee_id = task.assignee?.id ?? task.assignee_id ?? null;
    const username = task.assignee?.username?.trim() || unassignedLabel;
    const key = assignee_id ?? `__unassigned__`;
    let group = map.get(key);
    if (!group) {
      group = {
        assignee_id,
        username,
        total: 0,
        pending_accept: 0,
        accepted: 0,
        overdue_count: 0,
      };
      map.set(key, group);
    }
    group.total += 1;
    if (task.status === 'pending_accept') group.pending_accept += 1;
    if (task.status === 'accepted') group.accepted += 1;
    if (isWorkTaskOverdue(task)) group.overdue_count += 1;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.overdue_count !== a.overdue_count) return b.overdue_count - a.overdue_count;
    if (b.pending_accept !== a.pending_accept) return b.pending_accept - a.pending_accept;
    return b.total - a.total;
  });
}

export function listOverdueWorkTasks(
  items: WorkTask[],
  limit: number = WORK_TASK_DASHBOARD_OVERDUE_LIMIT
): WorkTask[] {
  return items
    .filter((task) => isWorkTaskOverdue(task))
    .sort((a, b) => (a.due_at ?? 0) - (b.due_at ?? 0))
    .slice(0, limit);
}

/** Max assignee task count for relative bar width (minimum 1). */
export function getMaxAssigneeGroupTotal(groups: WorkTaskAssigneeGroup[]): number {
  if (!groups.length) return 1;
  return Math.max(1, ...groups.map((g) => g.total));
}

export type WorkTaskAssigneeBarSegment = {
  key: 'pending' | 'accepted' | 'other';
  count: number;
};

/** Segments for stacked workload bar (pending / in progress / other statuses). */
export function getAssigneeWorkloadSegments(group: WorkTaskAssigneeGroup): WorkTaskAssigneeBarSegment[] {
  const other = Math.max(0, group.total - group.pending_accept - group.accepted);
  const segments: WorkTaskAssigneeBarSegment[] = [];
  if (group.pending_accept > 0) segments.push({ key: 'pending', count: group.pending_accept });
  if (group.accepted > 0) segments.push({ key: 'accepted', count: group.accepted });
  if (other > 0) segments.push({ key: 'other', count: other });
  return segments;
}
