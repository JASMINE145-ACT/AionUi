/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { app, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  WORK_TASK_ATTACHMENT_DELETE_CHANNEL,
  WORK_TASK_ATTACHMENT_HAS_CHANNEL,
  WORK_TASK_ATTACHMENT_RESOLVE_CHANNEL,
  WORK_TASK_ATTACHMENT_STORE_CHANNEL,
} from '@common/workTasks/workTaskAttachmentChannels';

function attachmentRootDir(): string {
  return path.join(app.getPath('userData'), 'work-task-attachments');
}

const ATTACHMENT_ID_PREFIX = 'wta_';

function attachmentBlobPath(attachmentId: string): string {
  if (
    !attachmentId.startsWith(ATTACHMENT_ID_PREFIX) ||
    attachmentId.includes('..') ||
    /[\\/]/.test(attachmentId)
  ) {
    throw new Error(`Invalid work task attachment id: ${attachmentId}`);
  }
  return path.join(attachmentRootDir(), attachmentId);
}

type StorePayload = {
  attachmentId: string;
  base64: string;
};

type AttachmentIdPayload = {
  attachmentId: string;
};

export async function storeWorkTaskAttachmentBlob(payload: StorePayload): Promise<{ success: true }> {
  await fs.mkdir(attachmentRootDir(), { recursive: true });
  const target = attachmentBlobPath(payload.attachmentId);
  await fs.writeFile(target, Buffer.from(payload.base64, 'base64'));
  return { success: true };
}

export async function hasWorkTaskAttachmentBlob(payload: AttachmentIdPayload): Promise<boolean> {
  try {
    const target = attachmentBlobPath(payload.attachmentId);
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function resolveWorkTaskAttachmentPath(
  payload: AttachmentIdPayload
): Promise<{ path: string | null }> {
  const exists = await hasWorkTaskAttachmentBlob(payload);
  if (!exists) {
    return { path: null };
  }
  return { path: attachmentBlobPath(payload.attachmentId) };
}

export async function deleteWorkTaskAttachmentBlob(payload: AttachmentIdPayload): Promise<{ success: true }> {
  try {
    await fs.unlink(attachmentBlobPath(payload.attachmentId));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code !== 'ENOENT') {
      throw error;
    }
  }
  return { success: true };
}

export function registerWorkTaskAttachmentHandlers(): void {
  ipcMain.handle(WORK_TASK_ATTACHMENT_STORE_CHANNEL, async (_event, payload: StorePayload) => {
    return storeWorkTaskAttachmentBlob(payload ?? { attachmentId: '', base64: '' });
  });

  ipcMain.handle(WORK_TASK_ATTACHMENT_HAS_CHANNEL, async (_event, payload: AttachmentIdPayload) => {
    return hasWorkTaskAttachmentBlob(payload ?? { attachmentId: '' });
  });

  ipcMain.handle(WORK_TASK_ATTACHMENT_RESOLVE_CHANNEL, async (_event, payload: AttachmentIdPayload) => {
    return resolveWorkTaskAttachmentPath(payload ?? { attachmentId: '' });
  });

  ipcMain.handle(WORK_TASK_ATTACHMENT_DELETE_CHANNEL, async (_event, payload: AttachmentIdPayload) => {
    return deleteWorkTaskAttachmentBlob(payload ?? { attachmentId: '' });
  });
}
