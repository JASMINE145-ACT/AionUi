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

const preferredModeByConversation = new Map<string, string>();

export function seedCcbSessionPreferredMode(
  conversationId: string,
  mode: string | null | undefined,
): void {
  const trimmed = mode?.trim();
  if (!trimmed) return;
  if (!preferredModeByConversation.has(conversationId)) {
    preferredModeByConversation.set(conversationId, trimmed);
  }
}

export function setCcbSessionPreferredMode(conversationId: string, mode: string): void {
  const trimmed = mode.trim();
  if (!trimmed) return;
  preferredModeByConversation.set(conversationId, trimmed);
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
): Promise<boolean> {
  const trimmed = mode.trim();
  if (!trimmed) return false;
  setCcbSessionPreferredMode(conversationId, trimmed);
  try {
    return await conversationBridge.update.invoke({
      id: conversationId,
      merge_extra: true,
      updates: {
        extra: {
          session_mode: trimmed,
        },
      },
    });
  } catch (error) {
    console.error('[persistCcbSessionPreferredMode] failed:', error);
    return false;
  }
}
