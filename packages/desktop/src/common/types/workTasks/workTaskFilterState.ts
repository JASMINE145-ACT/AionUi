/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkTask, WorkTaskStatus } from '@/common/types/workTasks/workTaskTypes';
import {
  WORK_TASK_STATUSES,
  isWorkTaskOverdue,
  type WorkTaskQueryParams,
} from '@/common/types/workTasks/workTaskTypes';

export type { WorkTaskQueryParams };

/** URL literal for null-assignee bucket (not a user id). */
export const WORK_TASKS_ASSIGNEE_UNASSIGNED = 'unassigned';

export const WORK_TASKS_FILTER_KEYS = ['assignee', 'status', 'overdue'] as const;

export type WorkTasksFilterState = {
  /** User id, `unassigned`, or null when unset. */
  assignee: string | null;
  status: WorkTaskStatus | null;
  overdue: boolean;
};

export type WorkTasksListMode =
  | { kind: 'list' }
  | { kind: 'query'; params: WorkTaskQueryParams; overdueClient: boolean }
  | { kind: 'unassigned_client'; status: WorkTaskStatus | null; overdue: boolean }
  /** Overdue-only against overview items — avoids unreliable `/query?overdue=` */
  | { kind: 'overview_client'; status: WorkTaskStatus | null; overdue: boolean };

export function emptyWorkTasksFilterState(): WorkTasksFilterState {
  return { assignee: null, status: null, overdue: false };
}

export function isWorkTasksFilterActive(state: WorkTasksFilterState): boolean {
  return state.assignee != null || state.status != null || state.overdue;
}

function firstParam(searchParams: URLSearchParams, key: string): string | null {
  const values = searchParams.getAll(key);
  if (!values.length) return null;
  const raw = values[0]?.trim() ?? '';
  return raw.length ? raw : null;
}

function isWorkTaskStatus(value: string): value is WorkTaskStatus {
  return (WORK_TASK_STATUSES as string[]).includes(value);
}

/**
 * Parse URL → filter state. Invalid values are dropped (`didNormalize`).
 */
export function parseWorkTasksSearchParams(searchParams: URLSearchParams): {
  state: WorkTasksFilterState;
  didNormalize: boolean;
} {
  let didNormalize = false;
  const state = emptyWorkTasksFilterState();

  const assigneeRaw = firstParam(searchParams, 'assignee');
  if (searchParams.has('assignee') && assigneeRaw == null) {
    didNormalize = true;
  } else if (assigneeRaw != null) {
    state.assignee = assigneeRaw;
  }
  if (searchParams.getAll('assignee').length > 1) didNormalize = true;

  const statusRaw = firstParam(searchParams, 'status');
  if (searchParams.has('status')) {
    if (statusRaw == null || !isWorkTaskStatus(statusRaw)) {
      didNormalize = true;
    } else {
      state.status = statusRaw;
    }
  }
  if (searchParams.getAll('status').length > 1) didNormalize = true;

  if (searchParams.has('overdue')) {
    const overdueRaw = firstParam(searchParams, 'overdue');
    if (overdueRaw === '1') {
      state.overdue = true;
    } else {
      didNormalize = true;
    }
  }
  if (searchParams.getAll('overdue').length > 1) didNormalize = true;

  // Non-canonical filter-ish keys → normalize away (display names never drive filters)
  for (const key of ['name', 'assignee_name']) {
    if (searchParams.has(key)) didNormalize = true;
  }

  return { state, didNormalize };
}

export function serializeWorkTasksFilterState(state: WorkTasksFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.assignee) params.set('assignee', state.assignee);
  if (state.status) params.set('status', state.status);
  if (state.overdue) params.set('overdue', '1');
  return params;
}

/** True if any canonical filter key is present (even invalid) — used for employee strip. */
export function hasWorkTasksFilterParams(searchParams: URLSearchParams): boolean {
  return WORK_TASKS_FILTER_KEYS.some((key) => searchParams.has(key));
}

/** Employee deep-link: strip filter keys; preserve unrelated params. */
export function stripWorkTasksFilterParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  for (const key of WORK_TASKS_FILTER_KEYS) {
    next.delete(key);
  }
  next.delete('name');
  next.delete('assignee_name');
  return next;
}

/**
 * Map filter state → list data mode.
 * - empty → listTasks
 * - unassigned → client filter of overview items
 * - assignee and/or status → `/query` (no overdue param); overdue applied client-side
 * - overdue-only → client filter of overview items
 *
 * Do **not** send `overdue` to `/query` — live AionCore fails that param (observed 2026-07-11).
 */
export function resolveWorkTasksListMode(state: WorkTasksFilterState): WorkTasksListMode {
  if (!isWorkTasksFilterActive(state)) {
    return { kind: 'list' };
  }

  if (state.assignee === WORK_TASKS_ASSIGNEE_UNASSIGNED) {
    return {
      kind: 'unassigned_client',
      status: state.status,
      overdue: state.overdue,
    };
  }

  if (state.assignee || state.status) {
    const params: WorkTaskQueryParams = {};
    if (state.assignee) params.assignee_id = state.assignee;
    if (state.status) params.status = state.status;
    return { kind: 'query', params, overdueClient: state.overdue };
  }

  return {
    kind: 'overview_client',
    status: state.status,
    overdue: state.overdue,
  };
}

/** `/query` params when list mode is server query; otherwise null. Never includes overdue. */
export function toWorkTaskQueryParams(state: WorkTasksFilterState): WorkTaskQueryParams | null {
  const mode = resolveWorkTasksListMode(state);
  return mode.kind === 'query' ? mode.params : null;
}

export function applyOverdueClientFilter(items: WorkTask[], overdue: boolean): WorkTask[] {
  if (!overdue) return items;
  return items.filter((task) => isWorkTaskOverdue(task));
}

export function filterOverviewClientWorkTasks(
  items: WorkTask[],
  options: { status: WorkTaskStatus | null; overdue: boolean }
): WorkTask[] {
  return items.filter((task) => {
    if (options.status && task.status !== options.status) return false;
    if (options.overdue && !isWorkTaskOverdue(task)) return false;
    return true;
  });
}

export function filterUnassignedWorkTasks(
  items: WorkTask[],
  options: { status: WorkTaskStatus | null; overdue: boolean }
): WorkTask[] {
  return items.filter((task) => {
    const assigneeId = task.assignee?.id ?? task.assignee_id ?? null;
    if (assigneeId != null) return false;
    if (options.status && task.status !== options.status) return false;
    if (options.overdue && !isWorkTaskOverdue(task)) return false;
    return true;
  });
}

export function withAssigneeFilter(
  state: WorkTasksFilterState,
  assignee: string | null
): WorkTasksFilterState {
  return { ...state, assignee };
}

export function withStatusFilter(
  state: WorkTasksFilterState,
  status: WorkTaskStatus | null
): WorkTasksFilterState {
  return { ...state, status };
}

export function withOverdueFilter(state: WorkTasksFilterState, overdue: boolean): WorkTasksFilterState {
  return { ...state, overdue };
}

export function clearStatusAndOverdue(state: WorkTasksFilterState): WorkTasksFilterState {
  return { ...state, status: null, overdue: false };
}
