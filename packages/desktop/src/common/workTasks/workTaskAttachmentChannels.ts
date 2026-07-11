/**
 * IPC channels for work-task attachment blobs stored under Electron userData.
 * Must match handlers in `process/bridge/workTaskAttachmentBridge.ts`.
 */

export const WORK_TASK_ATTACHMENT_STORE_CHANNEL = 'work-task-attachment-store';
export const WORK_TASK_ATTACHMENT_HAS_CHANNEL = 'work-task-attachment-has';
export const WORK_TASK_ATTACHMENT_DELETE_CHANNEL = 'work-task-attachment-delete';
export const WORK_TASK_ATTACHMENT_RESOLVE_CHANNEL = 'work-task-attachment-resolve';
