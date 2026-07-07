import { describe, expect, it } from 'vitest';
import {
  WORK_TASK_SCOPES,
  WORK_TASK_STATUSES,
  canTransitionWorkTaskStatus,
  isWorkTaskManager,
  isWorkTaskOverdue,
} from '../../../packages/desktop/src/common/types/workTasks/workTaskTypes';

describe('canTransitionWorkTaskStatus', () => {
  it('allows self-created default accepted path', () => {
    expect(canTransitionWorkTaskStatus('accepted', 'completed')).toBe(true);
    expect(canTransitionWorkTaskStatus('accepted', 'incomplete')).toBe(true);
    expect(canTransitionWorkTaskStatus('accepted', 'deferred')).toBe(true);
  });

  it('blocks terminal states from changing', () => {
    expect(canTransitionWorkTaskStatus('completed', 'accepted')).toBe(false);
    expect(canTransitionWorkTaskStatus('incomplete', 'accepted')).toBe(false);
  });

  it('allows deferred to resume', () => {
    expect(canTransitionWorkTaskStatus('deferred', 'accepted')).toBe(true);
  });

  it('covers all declared statuses', () => {
    expect(WORK_TASK_STATUSES.length).toBe(5);
  });
});

describe('work task scopes', () => {
  it('includes dual-view scopes', () => {
    expect(WORK_TASK_SCOPES).toContain('mine');
    expect(WORK_TASK_SCOPES).toContain('assigned');
  });
});

describe('isWorkTaskOverdue', () => {
  it('flags pending tasks past due date', () => {
    expect(
      isWorkTaskOverdue({
        status: 'pending_accept',
        due_at: Date.now() - 1000,
      })
    ).toBe(true);
  });

  it('ignores completed tasks', () => {
    expect(
      isWorkTaskOverdue({
        status: 'completed',
        due_at: Date.now() - 1000,
      })
    ).toBe(false);
  });
});

describe('isWorkTaskManager', () => {
  it('detects manager role', () => {
    expect(isWorkTaskManager('manager')).toBe(true);
    expect(isWorkTaskManager('employee')).toBe(false);
  });
});
