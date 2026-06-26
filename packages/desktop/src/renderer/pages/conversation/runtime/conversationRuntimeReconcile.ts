/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Poll backend conversation.runtime when the UI still shows processing but
 * WebSocket turn.completed / stream events may have been lost.
 */

import type { TConversationRuntimeSummary } from '@/common/config/storage';
import type { ConversationRuntimeView } from './conversationRuntimeViewStore';

/** First poll after send — backend usually finishes within ~10s for greetings. */
export const RUNTIME_RECONCILE_INITIAL_DELAY_MS = 3_000;

/** Subsequent polls while UI remains processing. */
export const RUNTIME_RECONCILE_POLL_INTERVAL_MS = 5_000;

export const shouldPollRuntimeReconciliation = (view: ConversationRuntimeView): boolean =>
  view.hydrated && view.isProcessing;

export const backendRuntimeNeedsReconciliation = (
  view: ConversationRuntimeView,
  backendRuntime: TConversationRuntimeSummary | null | undefined
): backendRuntime is TConversationRuntimeSummary =>
  view.isProcessing && backendRuntime !== null && backendRuntime !== undefined && backendRuntime.is_processing !== true;

export const resolveReconcileTurnId = (
  view: ConversationRuntimeView,
  backendRuntime: TConversationRuntimeSummary
): string => view.activeTurnId ?? backendRuntime.turn_id ?? 'reconciled';
