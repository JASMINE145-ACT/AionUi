import { describe, expect, it } from 'vitest';
import type { WorkTask } from '../../../packages/desktop/src/common/types/workTasks/workTaskTypes';
import {
  WORK_TASKS_ASSIGNEE_UNASSIGNED,
  applyOverdueClientFilter,
  clearStatusAndOverdue,
  emptyWorkTasksFilterState,
  filterOverviewClientWorkTasks,
  filterUnassignedWorkTasks,
  hasWorkTasksFilterParams,
  isWorkTasksFilterActive,
  parseWorkTasksSearchParams,
  resolveWorkTasksListMode,
  serializeWorkTasksFilterState,
  stripWorkTasksFilterParams,
  toWorkTaskQueryParams,
} from '../../../packages/desktop/src/common/types/workTasks/workTaskFilterState';

describe('parseWorkTasksSearchParams', () => {
  it('parses valid assignee status overdue', () => {
    const params = new URLSearchParams('assignee=u1&status=pending_accept&overdue=1');
    const { state, didNormalize } = parseWorkTasksSearchParams(params);
    expect(didNormalize).toBe(false);
    expect(state).toEqual({
      assignee: 'u1',
      status: 'pending_accept',
      overdue: true,
    });
  });

  it('strips invalid status and overdue≠1', () => {
    const params = new URLSearchParams('status=nope&overdue=0&assignee=');
    const { state, didNormalize } = parseWorkTasksSearchParams(params);
    expect(didNormalize).toBe(true);
    expect(state).toEqual(emptyWorkTasksFilterState());
  });

  it('takes first of multi-value keys and flags normalize', () => {
    const params = new URLSearchParams();
    params.append('assignee', 'a');
    params.append('assignee', 'b');
    const { state, didNormalize } = parseWorkTasksSearchParams(params);
    expect(didNormalize).toBe(true);
    expect(state.assignee).toBe('a');
  });

  it('flags name keys as normalize', () => {
    const params = new URLSearchParams('assignee=u1&name=yjc');
    const { state, didNormalize } = parseWorkTasksSearchParams(params);
    expect(didNormalize).toBe(true);
    expect(state.assignee).toBe('u1');
  });
});

describe('serializeWorkTasksFilterState', () => {
  it('round-trips without name key', () => {
    const state = {
      assignee: WORK_TASKS_ASSIGNEE_UNASSIGNED,
      status: 'accepted' as const,
      overdue: true,
    };
    const serialized = serializeWorkTasksFilterState(state);
    expect(serialized.get('assignee')).toBe('unassigned');
    expect(serialized.get('status')).toBe('accepted');
    expect(serialized.get('overdue')).toBe('1');
    expect(serialized.has('name')).toBe(false);
    const { state: again } = parseWorkTasksSearchParams(serialized);
    expect(again).toEqual(state);
  });
});

describe('resolveWorkTasksListMode / toWorkTaskQueryParams', () => {
  it('empty → list mode', () => {
    expect(resolveWorkTasksListMode(emptyWorkTasksFilterState())).toEqual({ kind: 'list' });
    expect(toWorkTaskQueryParams(emptyWorkTasksFilterState())).toBeNull();
    expect(isWorkTasksFilterActive(emptyWorkTasksFilterState())).toBe(false);
  });

  it('known assignee → query params without overdue; overdueClient flag', () => {
    const state = { assignee: 'u-yjc', status: 'pending_accept' as const, overdue: true };
    expect(resolveWorkTasksListMode(state)).toEqual({
      kind: 'query',
      params: { assignee_id: 'u-yjc', status: 'pending_accept' },
      overdueClient: true,
    });
    expect(toWorkTaskQueryParams(state)).toEqual({
      assignee_id: 'u-yjc',
      status: 'pending_accept',
    });
  });

  it('unassigned → client mode not query', () => {
    const state = { assignee: WORK_TASKS_ASSIGNEE_UNASSIGNED, status: null, overdue: true };
    expect(resolveWorkTasksListMode(state)).toEqual({
      kind: 'unassigned_client',
      status: null,
      overdue: true,
    });
    expect(toWorkTaskQueryParams(state)).toBeNull();
  });

  it('status-only → query', () => {
    const state = { assignee: null, status: 'completed' as const, overdue: false };
    expect(toWorkTaskQueryParams(state)).toEqual({ status: 'completed' });
  });

  it('overdue-only → overview_client (no /query overdue param)', () => {
    const state = { assignee: null, status: null, overdue: true };
    expect(resolveWorkTasksListMode(state)).toEqual({
      kind: 'overview_client',
      status: null,
      overdue: true,
    });
    expect(toWorkTaskQueryParams(state)).toBeNull();
  });
});

describe('employee strip', () => {
  it('detects and strips filter keys', () => {
    const params = new URLSearchParams('assignee=u1&status=accepted&overdue=1&tab=x');
    expect(hasWorkTasksFilterParams(params)).toBe(true);
    const stripped = stripWorkTasksFilterParams(params);
    expect(stripped.get('tab')).toBe('x');
    expect(hasWorkTasksFilterParams(stripped)).toBe(false);
  });
});

describe('filterUnassignedWorkTasks', () => {
  const past = Date.now() - 60_000;
  const items: WorkTask[] = [
    {
      id: '1',
      title: 'a',
      status: 'accepted',
      owner_user_id: 'o',
      created_by_id: 'c',
      metadata: {},
      attachments: [],
      created_at: 1,
      updated_at: 1,
    },
    {
      id: '2',
      title: 'b',
      status: 'pending_accept',
      owner_user_id: 'o',
      created_by_id: 'c',
      assignee_id: 'u1',
      assignee: { id: 'u1', username: 'yjc', work_task_role: 'employee' },
      metadata: {},
      attachments: [],
      created_at: 1,
      updated_at: 1,
    },
    {
      id: '3',
      title: 'c',
      status: 'accepted',
      owner_user_id: 'o',
      created_by_id: 'c',
      due_at: past,
      metadata: {},
      attachments: [],
      created_at: 1,
      updated_at: 1,
    },
  ];

  it('keeps null assignee only', () => {
    expect(filterUnassignedWorkTasks(items, { status: null, overdue: false }).map((t) => t.id)).toEqual([
      '1',
      '3',
    ]);
  });

  it('applies overdue', () => {
    expect(filterUnassignedWorkTasks(items, { status: null, overdue: true }).map((t) => t.id)).toEqual(['3']);
  });
});

describe('clearStatusAndOverdue', () => {
  it('keeps assignee', () => {
    expect(
      clearStatusAndOverdue({ assignee: 'u1', status: 'accepted', overdue: true })
    ).toEqual({ assignee: 'u1', status: null, overdue: false });
  });
});

describe('applyOverdueClientFilter / filterOverviewClientWorkTasks', () => {
  const past = Date.now() - 86_400_000;
  const future = Date.now() + 86_400_000;
  const items: WorkTask[] = [
    {
      id: 'open',
      title: 'open',
      status: 'accepted',
      owner_user_id: 'o',
      created_by_id: 'c',
      due_at: past,
      metadata: {},
      attachments: [],
      created_at: 1,
      updated_at: 1,
    },
    {
      id: 'ok',
      title: 'ok',
      status: 'pending_accept',
      owner_user_id: 'o',
      created_by_id: 'c',
      due_at: future,
      metadata: {},
      attachments: [],
      created_at: 1,
      updated_at: 1,
    },
    {
      id: 'done',
      title: 'done',
      status: 'completed',
      owner_user_id: 'o',
      created_by_id: 'c',
      due_at: past,
      metadata: {},
      attachments: [],
      created_at: 1,
      updated_at: 1,
    },
  ];

  it('applyOverdueClientFilter passthrough when false', () => {
    expect(applyOverdueClientFilter(items, false)).toBe(items);
  });

  it('applyOverdueClientFilter keeps only overdue active', () => {
    expect(applyOverdueClientFilter(items, true).map((t) => t.id)).toEqual(['open']);
  });

  it('filterOverviewClientWorkTasks status + overdue', () => {
    expect(
      filterOverviewClientWorkTasks(items, { status: 'accepted', overdue: true }).map((t) => t.id)
    ).toEqual(['open']);
    expect(
      filterOverviewClientWorkTasks(items, { status: 'pending_accept', overdue: false }).map((t) => t.id)
    ).toEqual(['ok']);
  });
});
