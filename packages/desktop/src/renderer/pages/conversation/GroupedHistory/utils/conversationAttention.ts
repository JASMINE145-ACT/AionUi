/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type ConversationAttentionKind = 'permission' | 'completion';

export type ConversationAttentionEvent = {
  kind: ConversationAttentionKind;
  conversation_id: string;
  title?: string;
  description?: string;
};

/** True when attention UI/notifications should fire (same rule as Cron unread). */
export function shouldNotifyConversationAttention(
  conversation_id: string,
  activeConversationId: string | null,
): boolean {
  return activeConversationId !== conversation_id;
}

export function parseActiveConversationIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/conversation\/([^/]+)/);
  return match?.[1] ?? null;
}
