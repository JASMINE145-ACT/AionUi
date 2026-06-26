/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Per-conversation processing start time for UI elapsed timers.
 * Survives conversation tab switches (ThoughtDisplay remounts).
 */

import { useSyncExternalStore } from 'react';

type ConversationProcessingClockListener = () => void;

const startedAtByConversation = new Map<string, number>();
const listeners = new Set<ConversationProcessingClockListener>();

const notify = (): void => {
  listeners.forEach((listener) => listener());
};

export const getConversationProcessingStartedAt = (conversation_id: string): number | undefined =>
  startedAtByConversation.get(conversation_id);

export const ensureConversationProcessingStartedAt = (
  conversation_id: string,
  startedAt: number = Date.now()
): number => {
  const existing = startedAtByConversation.get(conversation_id);
  if (existing !== undefined) {
    return existing;
  }
  startedAtByConversation.set(conversation_id, startedAt);
  notify();
  return startedAt;
};

export const clearConversationProcessingStartedAt = (conversation_id: string): void => {
  if (!startedAtByConversation.has(conversation_id)) {
    return;
  }
  startedAtByConversation.delete(conversation_id);
  notify();
};

export const subscribeConversationProcessingClock = (listener: ConversationProcessingClockListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useConversationProcessingStartedAt = (conversation_id: string): number | undefined => {
  const getSnapshot = (): number | undefined => getConversationProcessingStartedAt(conversation_id);
  return useSyncExternalStore(subscribeConversationProcessingClock, getSnapshot, getSnapshot);
};

export const resetConversationProcessingClockForTest = (): void => {
  startedAtByConversation.clear();
  listeners.clear();
};
