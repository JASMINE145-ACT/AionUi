import { describe, expect, it } from 'vitest';
import {
  WORK_TASK_SCOPES,
  WORK_TASK_STATUSES,
  canOpenWorkTaskAttachment,
  canTransitionWorkTaskStatus,
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
