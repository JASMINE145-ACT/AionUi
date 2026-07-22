/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { getConversationOrNull } from '@/renderer/pages/conversation/utils/conversationCache';
import { useEffect, useRef } from 'react';
import { addEventListener } from '@renderer/utils/emitter';

/** Idle fallback before force FullReview (TurnHarvest primary; Hermes-style nudge is main). */
export const PRECIPITATION_IDLE_DEBOUNCE_MS = 600_000;

const STORAGE_PREFIX = 'precipitation:turn-completed:';

type Options = {
  conversationId: string | undefined;
  enabled: boolean;
};

function storageKey(conversationId: string): string {
  return `${STORAGE_PREFIX}${conversationId}`;
}

/**
 * Prefer `acp_session_id` (hydrated from AionCore acp_session table);
 * fall back to `sessionKey` when that mirror is present.
 */
export function resolvePrecipitationSessionId(extra: Record<string, unknown> | undefined | null): string {
  if (!extra || typeof extra !== 'object') return '';
  const primary = typeof extra.acp_session_id === 'string' ? extra.acp_session_id.trim() : '';
  if (primary) return primary;
  const fallback = typeof extra.sessionKey === 'string' ? extra.sessionKey.trim() : '';
  return fallback;
}

async function recordEvent(input: {
  event: string;
  conversationId: string;
  sessionId?: string;
  runId?: string;
  skippedReason?: string;
  workerDetail?: string;
  durationMs?: number;
}): Promise<void> {
  try {
    await ipcBridge.ccbPrecipitationService.recordEvent.invoke(input);
  } catch {
    // non-fatal
  }
}

async function invokeSchedule(conversationId: string, turnId: string, armedAt: number): Promise<void> {
  const conversation = await getConversationOrNull(conversationId);
  const extra = conversation?.extra as Record<string, unknown> | undefined;
  let sessionId = resolvePrecipitationSessionId(extra);

  // One late binding pass: acp_session hydrate may land after turnCompleted.
  if (!sessionId) {
    await new Promise((r) => window.setTimeout(r, 500));
    const again = await getConversationOrNull(conversationId);
    sessionId = resolvePrecipitationSessionId(again?.extra as Record<string, unknown> | undefined);
  }

  const durationMs = Math.max(0, Date.now() - armedAt);

  if (!sessionId) {
    await recordEvent({
      event: 'schedule_skipped',
      conversationId,
      runId: turnId,
      skippedReason: 'missing_session_id',
      workerDetail: 'missing_session_id',
      durationMs,
    });
    return;
  }

  try {
    await ipcBridge.ccbPrecipitationService.schedule.invoke({
      sessionId,
      conversationId,
      turnId,
      agentId: conversation?.type === 'acp' ? String(conversation.extra?.backend || '') : '',
      force: true,
      skipCheckpoint: true,
    });
    // Main process records scheduled / schedule_skipped with desensitized detail.
  } catch {
    await recordEvent({
      event: 'schedule_skipped',
      conversationId,
      sessionId,
      runId: turnId,
      skippedReason: 'schedule_invoke_failed',
      workerDetail: 'schedule_invoke_failed',
      durationMs,
    });
  }
}

/** Schedule idle precipitation after a completed turn; cancel on new user send. */
export function useSessionPrecipitationSchedule({ conversationId, enabled }: Options): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const armTimer = (turnId: string) => {
    if (!conversationId) return;
    clearTimer();
    const at = Date.now();
    sessionStorage.setItem(storageKey(conversationId), JSON.stringify({ turnId, at }));
    void recordEvent({
      event: 'armed',
      conversationId,
      runId: turnId,
      durationMs: PRECIPITATION_IDLE_DEBOUNCE_MS,
    });
    timerRef.current = window.setTimeout(() => {
      sessionStorage.removeItem(storageKey(conversationId));
      void invokeSchedule(conversationId, turnId, at);
    }, PRECIPITATION_IDLE_DEBOUNCE_MS);
  };

  useEffect(() => {
    if (!enabled || !conversationId) {
      clearTimer();
      return;
    }

    const raw = sessionStorage.getItem(storageKey(conversationId));
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { turnId?: string; at?: number };
        const turnId = typeof parsed.turnId === 'string' ? parsed.turnId : '';
        const at = typeof parsed.at === 'number' ? parsed.at : 0;
        if (turnId && at > 0) {
          const remaining = PRECIPITATION_IDLE_DEBOUNCE_MS - (Date.now() - at);
          if (remaining <= 0) {
            sessionStorage.removeItem(storageKey(conversationId));
            void invokeSchedule(conversationId, turnId, at);
          } else {
            timerRef.current = window.setTimeout(() => {
              sessionStorage.removeItem(storageKey(conversationId));
              void invokeSchedule(conversationId, turnId, at);
            }, remaining);
          }
        }
      } catch {
        sessionStorage.removeItem(storageKey(conversationId));
      }
    }

    const turnCompletedEmitter = ipcBridge.conversation.turnCompleted;
    if (!turnCompletedEmitter) {
      return clearTimer;
    }

    const disposeTurnCompleted = turnCompletedEmitter.on((event) => {
      if (event.session_id !== conversationId) return;
      const turnId = typeof event.turn_id === 'string' ? event.turn_id.trim() : '';
      if (!turnId) return;
      void (async () => {
        const conversation = await getConversationOrNull(conversationId);
        const sessionId = resolvePrecipitationSessionId(
          conversation?.extra as Record<string, unknown> | undefined
        );
        if (sessionId) {
          try {
            const cp = await ipcBridge.ccbPrecipitationService.checkpoint.invoke({
              sessionId,
              conversationId,
              turnId,
              hasFinalResponse: true,
            });
            if (cp.shouldFullReview) {
              await ipcBridge.ccbPrecipitationService.schedule.invoke({
                sessionId,
                conversationId,
                turnId,
                agentId: conversation?.type === 'acp' ? String(conversation.extra?.backend || '') : '',
                skipCheckpoint: true,
              });
              return;
            }
          } catch {
            // fall through to idle arm
          }
        }
        armTimer(turnId);
      })();
    });

    return () => {
      disposeTurnCompleted();
      clearTimer();
    };
  }, [conversationId, enabled]);

  useEffect(() => {
    if (!enabled || !conversationId) return;
    return addEventListener('precipitation:user-send', (payload) => {
      if (payload.conversation_id !== conversationId) return;
      const hadTimer = timerRef.current !== null || Boolean(sessionStorage.getItem(storageKey(conversationId)));
      clearTimer();
      sessionStorage.removeItem(storageKey(conversationId));
      if (hadTimer) {
        void recordEvent({
          event: 'cancelled',
          conversationId,
        });
      }
    });
  }, [conversationId, enabled]);
}

export function emitPrecipitationUserSend(conversationId: string): void {
  void import('@renderer/utils/emitter').then(({ emitter }) => {
    emitter.emit('precipitation:user-send', { conversation_id: conversationId });
  });
}
