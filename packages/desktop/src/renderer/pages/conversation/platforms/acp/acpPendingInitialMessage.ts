/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/** Guid → conversation handoff for the first ACP user message. */

export type AcpInitialMessagePayload = {
  input: string;
  files?: string[];
};

const STORAGE_PREFIX = 'acp_initial_message_';
const CLAIM_SUFFIX = '__claim';

const pendingByMemory = new Map<string, string>();

function storageKey(conversationId: string): string {
  return `${STORAGE_PREFIX}${conversationId}`;
}

function claimKey(conversationId: string): string {
  return `${STORAGE_PREFIX}${conversationId}${CLAIM_SUFFIX}`;
}

function readSerialized(conversationId: string): string | null {
  return pendingByMemory.get(conversationId) ?? sessionStorage.getItem(storageKey(conversationId));
}

function wasFullPageReload(): boolean {
  if (typeof performance === 'undefined') {
    return false;
  }
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === 'reload';
}

/** Stage payload before navigating to the conversation page. */
export function stageAcpInitialMessage(conversationId: string, payload: AcpInitialMessagePayload): void {
  const serialized = JSON.stringify(payload);
  pendingByMemory.set(conversationId, serialized);
  sessionStorage.setItem(storageKey(conversationId), serialized);
  sessionStorage.removeItem(claimKey(conversationId));
}

/** Claim payload for send; returns null when already in-flight or missing. */
export function claimAcpInitialMessage(conversationId: string): AcpInitialMessagePayload | null {
  if (wasFullPageReload()) {
    sessionStorage.removeItem(claimKey(conversationId));
  }

  const existingClaim = sessionStorage.getItem(claimKey(conversationId));
  if (existingClaim) {
    return null;
  }

  const serialized = readSerialized(conversationId);
  if (!serialized) {
    return null;
  }

  sessionStorage.setItem(claimKey(conversationId), String(Date.now()));

  try {
    const parsed = JSON.parse(serialized) as AcpInitialMessagePayload;
    if (typeof parsed.input !== 'string') {
      clearAcpInitialMessage(conversationId);
      return null;
    }
    return parsed;
  } catch {
    clearAcpInitialMessage(conversationId);
    return null;
  }
}

/** Drop claim so a failed send can retry without losing payload. */
export function releaseAcpInitialMessageClaim(conversationId: string): void {
  sessionStorage.removeItem(claimKey(conversationId));
}

/** Remove staged payload after successful send. */
export function clearAcpInitialMessage(conversationId: string): void {
  pendingByMemory.delete(conversationId);
  sessionStorage.removeItem(storageKey(conversationId));
  sessionStorage.removeItem(claimKey(conversationId));
}

/** Test helper. */
export function resetAcpInitialMessageStoreForTests(): void {
  pendingByMemory.clear();
}
