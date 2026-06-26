/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/** Human work task status (organization /tasks module). */
export type WorkTaskStatus = 'pending_accept' | 'accepted' | 'completed' | 'incomplete' | 'deferred';

export type WorkTaskRole = 'manager' | 'employee';

/** List filter scope (matches AionCore `ListWorkTasksQuery.scope`). */
export type WorkTaskScope = 'visible' | 'mine' | 'assigned' | 'owned';

export type WorkTaskMember = {
  id: string;
  username: string;
  work_task_role: WorkTaskRole;
};

export type CreateTeamUserParams = {
  username: string;
  password: string;
  work_task_role?: WorkTaskRole;
};

export type UpdateTeamUserRoleParams = {
  userId: string;
  work_task_role: WorkTaskRole;
};

export type WorkTaskUserSummary = {
  id: string;
  username: string;
  work_task_role: WorkTaskRole;
};

export type WorkTaskAttachment = {
  id: string;
  task_id: string;
  file_name: string;
  file_path: string;
  mime_type?: string;
  size: number;
  created_at: number;
};

export type WorkTask = {
  id: string;
  owner_user_id: string;
  title: string;
  description?: string;
  status: WorkTaskStatus;
  created_by_id: string;
  assignee_id?: string;
  due_at?: number;
  metadata: Record<string, unknown>;
  attachments: WorkTaskAttachment[];
  created_at: number;
  updated_at: number;
  assignee?: WorkTaskUserSummary;
  created_by?: WorkTaskUserSummary;
};

export type CreateWorkTaskParams = {
  title: string;
  description?: string;
  status?: WorkTaskStatus;
  assignee_id?: string;
  due_at?: number;
  metadata?: Record<string, unknown>;
};

export type UpdateWorkTaskParams = {
  title?: string;
  description?: string | null;
  status?: WorkTaskStatus;
  assignee_id?: string | null;
  due_at?: number | null;
  metadata?: Record<string, unknown>;
};

export type AddWorkTaskAttachmentParams = {
  task_id: string;
  file_name: string;
  file_path: string;
  mime_type?: string;
  size?: number;
};

export type WorkTaskQuerySummary = {
  total: number;
  pending_accept: number;
  accepted: number;
  completed: number;
  incomplete: number;
  deferred: number;
  overdue_count: number;
};

export type WorkTaskQueryResponse = {
  summary: WorkTaskQuerySummary;
  items: WorkTask[];
};

export const WORK_TASK_STATUSES: WorkTaskStatus[] = [
  'pending_accept',
  'accepted',
  'completed',
  'incomplete',
  'deferred',
];

export const WORK_TASK_SCOPES: WorkTaskScope[] = ['visible', 'mine', 'assigned', 'owned'];

export const WORK_TASK_STATUS_I18N_KEY: Record<WorkTaskStatus, string> = {
  pending_accept: 'workTasks.status.pendingAccept',
  accepted: 'workTasks.status.accepted',
  completed: 'workTasks.status.completed',
  incomplete: 'workTasks.status.incomplete',
  deferred: 'workTasks.status.deferred',
};

export const WORK_TASK_SCOPE_I18N_KEY: Record<WorkTaskScope, string> = {
  visible: 'workTasks.scope.visible',
  mine: 'workTasks.scope.mine',
  assigned: 'workTasks.scope.assigned',
  owned: 'workTasks.scope.owned',
};

/** Valid status transitions for UI guards. */
export function canTransitionWorkTaskStatus(from: WorkTaskStatus, to: WorkTaskStatus): boolean {
  if (from === to) return true;
  switch (from) {
    case 'pending_accept':
      return to === 'accepted' || to === 'deferred';
    case 'accepted':
      return to === 'completed' || to === 'incomplete' || to === 'deferred';
    case 'deferred':
      return to === 'accepted';
    case 'completed':
    case 'incomplete':
      return false;
    default:
      return false;
  }
}

export function isWorkTaskOverdue(task: Pick<WorkTask, 'due_at' | 'status'>): boolean {
  if (!task.due_at) return false;
  if (task.status !== 'pending_accept' && task.status !== 'accepted') return false;
  return task.due_at < Date.now();
}

export function isWorkTaskManager(role?: string | null): boolean {
  return role === 'manager';
}
