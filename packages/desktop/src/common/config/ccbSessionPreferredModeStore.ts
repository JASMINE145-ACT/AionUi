/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * In-memory session permission mode per conversation.
 * Updated synchronously on UI switch so send paths see the latest choice
 * before conversation.extra is reloaded from the main process.
 */

import { conversation as conversationBridge } from '@/common/adapter/ipcBridge';
import { normalizeAcpPermissionMode } from '@/common/config/normalizeAcpPermissionMode';

const preferredModeByConversation = new Map<string, string>();

export function seedCcbSessionPreferredMode(
  conversationId: string,
  mode: string | null | undefined,
  backend?: string,
): void {
  const normalized = normalizeAcpPermissionMode(backend, mode);
  if (!normalized) return;
  if (!preferredModeByConversation.has(conversationId)) {
    preferredModeByConversation.set(conversationId, normalized);
  }
}

export function setCcbSessionPreferredMode(
  conversationId: string,
  mode: string,
  backend?: string,
): void {
  const normalized = normalizeAcpPermissionMode(backend, mode);
  if (!normalized) return;
  preferredModeByConversation.set(conversationId, normalized);
}

export function getCcbSessionPreferredMode(
  conversationId: string,
  fallback?: string,
): string | undefined {
  return preferredModeByConversation.get(conversationId) ?? fallback;
}

export function clearCcbSessionPreferredMode(conversationId: string): void {
  preferredModeByConversation.delete(conversationId);
}

/** Persist session mode choice to conversation.extra for reload/resume. */
export async function persistCcbSessionPreferredMode(
  conversationId: string,
  mode: string,
  backend?: string,
): Promise<boolean> {
  const normalized = normalizeAcpPermissionMode(backend, mode);
  if (!normalized) return false;
  setCcbSessionPreferredMode(conversationId, normalized, backend);
  try {
    return await conversationBridge.update.invoke({
      id: conversationId,
      merge_extra: true,
      updates: {
        extra: {
          session_mode: normalized,
        },
      },
    });
  } catch (error) {
    console.error('[persistCcbSessionPreferredMode] failed:', error);
    return false;
  }
}
