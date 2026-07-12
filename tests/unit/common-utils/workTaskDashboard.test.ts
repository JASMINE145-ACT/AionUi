import { describe, expect, it } from 'vitest';
import type { WorkTask } from '../../../packages/desktop/src/common/types/workTasks/workTaskTypes';
import {
  WORK_TASK_DASHBOARD_ITEMS_CAP,
  capWorkTasksForDashboard,
  groupWorkTasksByAssignee,
  listOverdueWorkTasks,
  getMaxAssigneeGroupTotal,
  getAssigneeWorkloadSegments,
} from '../../../packages/desktop/src/common/types/workTasks/workTaskDashboard';

function task(partial: Partial<WorkTask> & Pick<WorkTask, 'id' | 'title' | 'status'>): WorkTask {
  return {
    description: null,
    owner_user_id: 'o1',
    created_by_id: 'c1',
    assignee_id: null,
    due_at: null,
    metadata: {},
    created_at: 1,
    updated_at: 1,
    attachments: [],
    ...partial,
  };
}

describe('capWorkTasksForDashboard', () => {
  it('caps and flags truncation', () => {
    const items = Array.from({ length: WORK_TASK_DASHBOARD_ITEMS_CAP + 3 }, (_, i) =>
      task({ id: `t${i}`, title: `T${i}`, status: 'accepted' })
    );
    const slice = capWorkTasksForDashboard(items);
    expect(slice.items).toHaveLength(WORK_TASK_DASHBOARD_ITEMS_CAP);
    expect(slice.truncated).toBe(true);
    expect(slice.totalBeforeCap).toBe(items.length);
  });
});

describe('groupWorkTasksByAssignee', () => {
  it('groups by assignee and counts overdue', () => {
    const past = Date.now() - 60_000;
    const items = [
      task({
        id: '1',
        title: 'a',
        status: 'pending_accept',
        assignee: { id: 'u1', username: 'yjc', work_task_role: 'employee' },
      }),
      task({
        id: '2',
        title: 'b',
        status: 'accepted',
        due_at: past,
        assignee: { id: 'u1', username: 'yjc', work_task_role: 'employee' },
      }),
      task({
        id: '3',
        title: 'c',
        status: 'accepted',
        assignee: { id: 'u2', username: 'other', work_task_role: 'employee' },
      }),
      task({ id: '4', title: 'd', status: 'accepted' }),
    ];
    const groups = groupWorkTasksByAssignee(items, '未分配');
    expect(groups).toHaveLength(3);
    const yjc = groups.find((g) => g.assignee_id === 'u1');
    expect(yjc?.total).toBe(2);
    expect(yjc?.pending_accept).toBe(1);
    expect(yjc?.accepted).toBe(1);
    expect(yjc?.overdue_count).toBe(1);
    const unassigned = groups.find((g) => g.assignee_id === null);
    expect(unassigned?.username).toBe('未分配');
    expect(unassigned?.total).toBe(1);
  });
});

describe('listOverdueWorkTasks', () => {
  it('returns only overdue active tasks up to limit', () => {
    const past = Date.now() - 60_000;
    const items = [
      task({ id: '1', title: 'a', status: 'accepted', due_at: past }),
      task({ id: '2', title: 'b', status: 'completed', due_at: past }),
      task({ id: '3', title: 'c', status: 'pending_accept', due_at: past }),
      task({ id: '4', title: 'd', status: 'accepted', due_at: Date.now() + 60_000 }),
    ];
    const overdue = listOverdueWorkTasks(items, 10);
    expect(overdue.map((t) => t.id)).toEqual(['1', '3']);
    expect(listOverdueWorkTasks(items, 1)).toHaveLength(1);
  });
});

describe('getMaxAssigneeGroupTotal', () => {
  it('returns max total with minimum 1', () => {
    expect(getMaxAssigneeGroupTotal([])).toBe(1);
    expect(
      getMaxAssigneeGroupTotal([
        { assignee_id: 'a', username: 'A', total: 3, pending_accept: 1, accepted: 2, overdue_count: 0 },
        { assignee_id: 'b', username: 'B', total: 7, pending_accept: 0, accepted: 7, overdue_count: 1 },
      ])
    ).toBe(7);
  });
});

describe('getAssigneeWorkloadSegments', () => {
  it('splits pending, accepted, and other counts', () => {
    const segments = getAssigneeWorkloadSegments({
      assignee_id: 'u1',
      username: 'yjc',
      total: 5,
      pending_accept: 2,
      accepted: 2,
      overdue_count: 0,
    });
    expect(segments).toEqual([
      { key: 'pending', count: 2 },
      { key: 'accepted', count: 2 },
      { key: 'other', count: 1 },
    ]);
  });
});
