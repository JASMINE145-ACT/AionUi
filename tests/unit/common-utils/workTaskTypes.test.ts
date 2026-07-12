import { describe, expect, it } from 'vitest';
import {
  WORK_TASK_SCOPES,
  WORK_TASK_STATUSES,
  canAcceptWorkTask,
  canCompleteWorkTask,
  canDeleteWorkTask,
  canEditWorkTaskMeta,
  canOpenWorkTaskAttachment,
  canTransitionWorkTaskStatus,
  filterWorkTaskStatusOptions,
  getWorkTaskAttachmentStorageMode,
  isWorkTaskManager,
  isWorkTaskAgentCreated,
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

describe('isWorkTaskAgentCreated', () => {
  it('detects agent metadata source', () => {
    expect(isWorkTaskAgentCreated({ metadata: { source: 'agent' } })).toBe(true);
    expect(isWorkTaskAgentCreated({ metadata: { source: 'work-tasks-agent' } })).toBe(true);
    expect(isWorkTaskAgentCreated({ metadata: {} })).toBe(false);
    expect(isWorkTaskAgentCreated({ metadata: { source: 'human' } })).toBe(false);
  });
});

describe('canAcceptWorkTask (ACCEPT_ACTOR.001 Option A)', () => {
  const pending = {
    status: 'pending_accept' as const,
    assignee_id: 'assignee_1',
    assignee: { id: 'assignee_1', name: 'YJC' },
  };

  it('allows assignee to accept', () => {
    expect(canAcceptWorkTask(pending, 'assignee_1')).toBe(true);
  });

  it('blocks manager/non-assignee from accept', () => {
    expect(canAcceptWorkTask(pending, 'manager_1')).toBe(false);
    expect(canAcceptWorkTask(pending, null)).toBe(false);
  });

  it('blocks accept when not pending_accept', () => {
    expect(
      canAcceptWorkTask({ ...pending, status: 'accepted' }, 'assignee_1')
    ).toBe(false);
  });
});

describe('filterWorkTaskStatusOptions', () => {
  it('hides accepted from pending_accept for non-assignee manager', () => {
    const task = {
      status: 'pending_accept' as const,
      assignee_id: 'assignee_1',
      assignee: { id: 'assignee_1', name: 'YJC' },
    };
    expect(filterWorkTaskStatusOptions(task, 'manager_1', 'manager')).not.toContain('accepted');
    expect(filterWorkTaskStatusOptions(task, 'assignee_1', 'employee')).toContain('accepted');
  });

  it('still allows deferred from pending_accept for manager', () => {
    const task = {
      status: 'pending_accept' as const,
      assignee_id: 'assignee_1',
      assignee: { id: 'assignee_1', name: 'YJC' },
    };
    expect(filterWorkTaskStatusOptions(task, 'manager_1', 'manager')).toContain('deferred');
  });

  it('hides all status options for unrelated employee', () => {
    const task = {
      status: 'accepted' as const,
      assignee_id: 'assignee_1',
      assignee: { id: 'assignee_1', name: 'YJC' },
    };
    expect(filterWorkTaskStatusOptions(task, 'stranger', 'employee')).toEqual([]);
  });
});

describe('manager team ops helpers (Q1=B / Q2=A)', () => {
  const task = {
    status: 'accepted' as const,
    created_by_id: 'mgr_a',
    created_by: { id: 'mgr_a', username: 'a', work_task_role: 'manager' as const },
    assignee_id: 'emp',
    assignee: { id: 'emp', username: 'e', work_task_role: 'employee' as const },
  };

  it('any manager may edit meta, delete, and complete', () => {
    expect(canEditWorkTaskMeta(task, 'mgr_b', 'manager')).toBe(true);
    expect(canDeleteWorkTask(task, 'mgr_b', 'manager')).toBe(true);
    expect(canCompleteWorkTask(task, 'mgr_b', 'manager')).toBe(true);
  });

  it('unrelated employee cannot', () => {
    expect(canEditWorkTaskMeta(task, 'stranger', 'employee')).toBe(false);
    expect(canDeleteWorkTask(task, 'stranger', 'employee')).toBe(false);
    expect(canCompleteWorkTask(task, 'stranger', 'employee')).toBe(false);
  });
});

describe('work task attachment storage', () => {
  it('defaults legacy rows without storage_mode to remote when path present', () => {
    expect(getWorkTaskAttachmentStorageMode({ storage_mode: undefined, file_path: '/tmp/a.pdf' })).toBe('remote');
    expect(getWorkTaskAttachmentStorageMode({ storage_mode: undefined, file_path: '' })).toBe('local');
  });

  it('allows open only for local uploader with local blob', () => {
    const attachment = {
      storage_mode: 'local' as const,
      file_path: '',
      uploaded_by_id: 'user_a',
    };
    expect(canOpenWorkTaskAttachment(attachment, 'user_a', true)).toBe(true);
    expect(canOpenWorkTaskAttachment(attachment, 'user_b', true)).toBe(false);
    expect(canOpenWorkTaskAttachment(attachment, 'user_a', false)).toBe(false);
    expect(
      canOpenWorkTaskAttachment(
        { storage_mode: 'remote', file_path: '/tmp/a.pdf', uploaded_by_id: 'user_a' },
        'user_a',
        false
      )
    ).toBe(true);
    expect(
      canOpenWorkTaskAttachment(
        { storage_mode: 'remote', file_path: '', uploaded_by_id: 'user_a' },
        'user_a',
        false
      )
    ).toBe(false);
  });
});
