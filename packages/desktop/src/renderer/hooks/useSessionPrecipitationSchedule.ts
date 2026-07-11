/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { getConversationOrNull } from '@/renderer/pages/conversation/utils/conversationCache';
import { useEffect, useRef } from 'react';
import { addEventListener } from '@renderer/utils/emitter';

const DEBOUNCE_MS = 60_000;
const STORAGE_PREFIX = 'precipitation:turn-completed:';

type Options = {
  conversationId: string | undefined;
  enabled: boolean;
};

function storageKey(conversationId: string): string {
  return `${STORAGE_PREFIX}${conversationId}`;
}

async function invokeSchedule(conversationId: string, turnId: string): Promise<void> {
  const conversation = await getConversationOrNull(conversationId);
  const extra = conversation?.extra as { acp_session_id?: string } | undefined;
  const sessionId = typeof extra?.acp_session_id === 'string' ? extra.acp_session_id.trim() : '';
  if (!sessionId) return;
  try {
    await ipcBridge.ccbPrecipitationService.schedule.invoke({
      sessionId,
      conversationId,
      turnId,
      agentId: conversation?.type === 'acp' ? String(conversation.extra?.backend || '') : '',
    });
  } catch {
    // non-fatal
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
    sessionStorage.setItem(storageKey(conversationId), JSON.stringify({ turnId, at: Date.now() }));
    timerRef.current = window.setTimeout(() => {
      sessionStorage.removeItem(storageKey(conversationId));
      void invokeSchedule(conversationId, turnId);
    }, DEBOUNCE_MS);
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
          const remaining = DEBOUNCE_MS - (Date.now() - at);
          if (remaining <= 0) {
            sessionStorage.removeItem(storageKey(conversationId));
            void invokeSchedule(conversationId, turnId);
          } else {
            timerRef.current = window.setTimeout(() => {
              sessionStorage.removeItem(storageKey(conversationId));
              void invokeSchedule(conversationId, turnId);
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
      armTimer(turnId);
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
      clearTimer();
      sessionStorage.removeItem(storageKey(conversationId));
    });
  }, [conversationId, enabled]);
}

export function emitPrecipitationUserSend(conversationId: string): void {
  void import('@renderer/utils/emitter').then(({ emitter }) => {
    emitter.emit('precipitation:user-send', { conversation_id: conversationId });
  });
}
