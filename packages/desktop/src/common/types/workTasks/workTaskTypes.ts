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

export type WorkTaskStorageMode = 'local' | 'remote';

export type WorkTaskAttachment = {
  id: string;
  task_id: string;
  file_name: string;
  file_path?: string;
  mime_type?: string;
  size: number;
  created_at: number;
  storage_mode?: WorkTaskStorageMode;
  uploaded_by_id?: string;
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
  file_path?: string;
  mime_type?: string;
  size?: number;
  storage_mode?: WorkTaskStorageMode;
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

/** Manager `/api/work-tasks/query` query string (P6 drill-down). Never includes overdue — filter client-side. */
export type WorkTaskQueryParams = {
  status?: WorkTaskStatus;
  assignee_id?: string;
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

/** True when current user is the task assignee (id match). */
export function isWorkTaskAssignee(
  task: Pick<WorkTask, 'assignee_id' | 'assignee'>,
  currentUserId: string | undefined | null
): boolean {
  if (!currentUserId) return false;
  const assigneeId = task.assignee?.id ?? task.assignee_id ?? null;
  return assigneeId === currentUserId;
}

/**
 * 「接受」CTA — assignee-only (WANd.TASKS.ACCEPT_ACTOR.001 Option A).
 * Graph edge alone is not enough; manager-creators must not see Accept.
 */
export function canAcceptWorkTask(
  task: Pick<WorkTask, 'status' | 'assignee_id' | 'assignee'>,
  currentUserId: string | undefined | null
): boolean {
  if (task.status !== 'pending_accept') return false;
  if (!canTransitionWorkTaskStatus('pending_accept', 'accepted')) return false;
  return isWorkTaskAssignee(task, currentUserId);
}

/**
 * Status options for the change-status select, filtered by actor.
 * Non-assignees cannot choose `accepted` from `pending_accept`.
 * Only assignee or manager may change status at all (Q1=B / Q2=A).
 */
export function filterWorkTaskStatusOptions(
  task: Pick<WorkTask, 'status' | 'assignee_id' | 'assignee'>,
  currentUserId: string | undefined | null,
  role?: string | null,
  statuses: readonly WorkTaskStatus[] = WORK_TASK_STATUSES
): WorkTaskStatus[] {
  if (!canChangeWorkTaskStatus(task, currentUserId, role)) {
    return [];
  }
  return statuses.filter((to) => {
    if (to === task.status) return false;
    if (!canTransitionWorkTaskStatus(task.status, to)) return false;
    if (task.status === 'pending_accept' && to === 'accepted') {
      return isWorkTaskAssignee(task, currentUserId);
    }
    return true;
  });
}

/** Assignee or any manager may drive non-accept status edges. */
export function canChangeWorkTaskStatus(
  task: Pick<WorkTask, 'assignee_id' | 'assignee'>,
  currentUserId: string | undefined | null,
  role?: string | null
): boolean {
  return isWorkTaskAssignee(task, currentUserId) || isWorkTaskManager(role);
}

export function canCompleteWorkTask(
  task: Pick<WorkTask, 'status' | 'assignee_id' | 'assignee'>,
  currentUserId: string | undefined | null,
  role?: string | null
): boolean {
  if (!canTransitionWorkTaskStatus(task.status, 'completed')) return false;
  return canChangeWorkTaskStatus(task, currentUserId, role);
}

/** Q1=B: any manager, or the creator. */
export function canEditWorkTaskMeta(
  task: Pick<WorkTask, 'created_by_id' | 'created_by'>,
  currentUserId: string | undefined | null,
  role?: string | null
): boolean {
  if (isWorkTaskManager(role)) return true;
  if (!currentUserId) return false;
  const creatorId = task.created_by?.id ?? task.created_by_id;
  return creatorId === currentUserId;
}

/** Q1=B: any manager, or creator∧assignee (self-owned). */
export function canDeleteWorkTask(
  task: Pick<WorkTask, 'created_by_id' | 'created_by' | 'assignee_id' | 'assignee'>,
  currentUserId: string | undefined | null,
  role?: string | null
): boolean {
  if (isWorkTaskManager(role)) return true;
  if (!currentUserId) return false;
  const creatorId = task.created_by?.id ?? task.created_by_id;
  return creatorId === currentUserId && isWorkTaskAssignee(task, currentUserId);
}

/** ManageAttachments — creator or assignee only (unchanged by Q1=B). */
export function canManageWorkTaskAttachments(
  task: Pick<WorkTask, 'created_by_id' | 'created_by' | 'assignee_id' | 'assignee'>,
  currentUserId: string | undefined | null
): boolean {
  if (!currentUserId) return false;
  const creatorId = task.created_by?.id ?? task.created_by_id;
  if (creatorId === currentUserId) return true;
  return isWorkTaskAssignee(task, currentUserId);
}

export function isWorkTaskOverdue(task: Pick<WorkTask, 'due_at' | 'status'>): boolean {
  if (!task.due_at) return false;
  if (task.status !== 'pending_accept' && task.status !== 'accepted') return false;
  return task.due_at < Date.now();
}

export function isWorkTaskManager(role?: string | null): boolean {
  return role === 'manager';
}

/** True when task metadata marks agent/MCP as the creation source (AC5). */
export function isWorkTaskAgentCreated(task: Pick<WorkTask, 'metadata'>): boolean {
  const source = task.metadata?.source;
  return source === 'agent' || source === 'work-tasks-agent';
}

export function getWorkTaskAttachmentStorageMode(
  attachment: Pick<WorkTaskAttachment, 'storage_mode' | 'file_path'>
): WorkTaskStorageMode {
  if (attachment.storage_mode === 'local' || attachment.storage_mode === 'remote') {
    return attachment.storage_mode;
  }
  return attachment.file_path ? 'remote' : 'local';
}

/** Local blobs are openable on the uploader device; legacy remote rows may use stored paths. */
export function canOpenWorkTaskAttachment(
  attachment: Pick<WorkTaskAttachment, 'storage_mode' | 'file_path' | 'uploaded_by_id'>,
  currentUserId: string | undefined,
  hasLocalBlob: boolean
): boolean {
  const mode = getWorkTaskAttachmentStorageMode(attachment);
  if (mode === 'remote') {
    return Boolean(attachment.file_path?.trim());
  }
  if (!currentUserId || attachment.uploaded_by_id !== currentUserId) {
    return false;
  }
  return hasLocalBlob;
}
