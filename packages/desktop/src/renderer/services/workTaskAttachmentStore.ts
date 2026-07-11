/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  WORK_TASK_ATTACHMENT_DELETE_CHANNEL,
  WORK_TASK_ATTACHMENT_HAS_CHANNEL,
  WORK_TASK_ATTACHMENT_RESOLVE_CHANNEL,
  WORK_TASK_ATTACHMENT_STORE_CHANNEL,
} from '@/common/workTasks/workTaskAttachmentChannels';

function requireElectronIpc(): NonNullable<typeof window.electronAPI.invokeIpc> {
  if (typeof window === 'undefined' || typeof window.electronAPI?.invokeIpc !== 'function') {
    throw new Error('Work task attachment storage requires Electron main-process IPC');
  }
  return window.electronAPI.invokeIpc;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function storeWorkTaskAttachmentBlob(attachmentId: string, file: File): Promise<void> {
  const invokeIpc = requireElectronIpc();
  const base64 = await readFileAsBase64(file);
  await invokeIpc(WORK_TASK_ATTACHMENT_STORE_CHANNEL, { attachmentId, base64 });
}

export async function hasLocalWorkTaskAttachmentBlob(attachmentId: string): Promise<boolean> {
  const invokeIpc = requireElectronIpc();
  return Boolean(await invokeIpc(WORK_TASK_ATTACHMENT_HAS_CHANNEL, { attachmentId }));
}

export async function resolveLocalWorkTaskAttachmentPath(attachmentId: string): Promise<string | null> {
  const invokeIpc = requireElectronIpc();
  const result = (await invokeIpc(WORK_TASK_ATTACHMENT_RESOLVE_CHANNEL, { attachmentId })) as {
    path?: string | null;
  };
  return result?.path ?? null;
}

export async function deleteLocalWorkTaskAttachmentBlob(attachmentId: string): Promise<void> {
  const invokeIpc = requireElectronIpc();
  await invokeIpc(WORK_TASK_ATTACHMENT_DELETE_CHANNEL, { attachmentId });
}
