/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import {
  type ConversationAttentionEvent,
  parseActiveConversationIdFromPath,
  shouldNotifyConversationAttention,
} from '@/renderer/pages/conversation/GroupedHistory/utils/conversationAttention';
import { addEventListener } from '@/renderer/utils/emitter';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * Whitelist of message types that indicate content generation is in progress.
 * Only these types should trigger the sidebar loading spinner.
 * Using a whitelist (instead of a blacklist) prevents unknown/internal message
 * types (e.g. slash_commands_updated, acp_context_usage) from falsely
 * triggering the generating state.
 */
const isGeneratingStreamMessage = (type: string): boolean => {
  return (
    type === 'content' ||
    type === 'start' ||
    type === 'thought' ||
    type === 'thinking' ||
    type === 'tool_group' ||
    type === 'acp_tool_call' ||
    type === 'acp_permission' ||
    type === 'permission' ||
    type === 'plan'
  );
};

const isTerminalAgentStatus = (data: unknown): boolean => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const { status } = data as { status?: string };
  return status === 'error' || status === 'disconnected';
};

const isTerminalStreamMessage = (message: { type: string; data: unknown }): boolean => {
  return (
    message.type === 'finish' ||
    message.type === 'error' ||
    (message.type === 'agent_status' && isTerminalAgentStatus(message.data))
  );
};

const isTerminalTurnState = (state: string): boolean => {
  return state === 'ai_waiting_input' || state === 'error' || state === 'stopped';
};

export type SidebarStreamGuardDecision = {
  markGenerating: boolean;
  clearCompleted: boolean;
  lateIgnored: boolean;
};

export const getSidebarStreamGuardDecision = ({
  type,
  completed,
}: {
  type: string;
  completed: boolean;
}): SidebarStreamGuardDecision => {
  if (!isGeneratingStreamMessage(type)) {
    return {
      markGenerating: false,
      clearCompleted: false,
      lateIgnored: false,
    };
  }

  if (type === 'start') {
    return {
      markGenerating: true,
      clearCompleted: true,
      lateIgnored: false,
    };
  }

  if (completed) {
    return {
      markGenerating: false,
      clearCompleted: false,
      lateIgnored: true,
    };
  }

  return {
    markGenerating: true,
    clearCompleted: false,
    lateIgnored: false,
  };
};

type ConversationListSyncSnapshot = {
  conversations: TChatConversation[];
  generatingConversationIds: Set<string>;
  completionUnreadConversationIds: Set<string>;
  permissionUnreadConversationIds: Set<string>;
};

const listeners = new Set<() => void>();
const attentionSubscribers = new Set<(event: ConversationAttentionEvent) => void>();

let isStoreInitialized = false;
let conversationsState: TChatConversation[] = [];
let generatingConversationIdsState = new Set<string>();
let completionUnreadConversationIdsState = new Set<string>();
let permissionUnreadConversationIdsState = new Set<string>();
let permissionPendingCountsState = new Map<string, number>();
let completedConversationIdsState = new Set<string>();
let conversation_idsState = new Set<string>();
let activeConversationIdState: string | null = null;
let snapshotState: ConversationListSyncSnapshot = {
  conversations: conversationsState,
  generatingConversationIds: generatingConversationIdsState,
  completionUnreadConversationIds: completionUnreadConversationIdsState,
  permissionUnreadConversationIds: permissionUnreadConversationIdsState,
};

const emitStoreChange = () => {
  snapshotState = {
    conversations: conversationsState,
    generatingConversationIds: generatingConversationIdsState,
    completionUnreadConversationIds: completionUnreadConversationIdsState,
    permissionUnreadConversationIds: permissionUnreadConversationIdsState,
  };
  listeners.forEach((listener) => listener());
};

const ATTENTION_COMPLETION_DEDUP_MS = 3000;
let lastCompletionAttentionAt = new Map<string, number>();

const emitAttentionEvent = (event: ConversationAttentionEvent) => {
  if (event.kind === 'completion') {
    const lastAt = lastCompletionAttentionAt.get(event.conversation_id) ?? 0;
    const now = Date.now();
    if (now - lastAt < ATTENTION_COMPLETION_DEDUP_MS) {
      return;
    }
    lastCompletionAttentionAt.set(event.conversation_id, now);
  }

  attentionSubscribers.forEach((listener) => listener(event));
};

export const subscribeConversationAttentionEvents = (
  listener: (event: ConversationAttentionEvent) => void,
): (() => void) => {
  attentionSubscribers.add(listener);
  return () => {
    attentionSubscribers.delete(listener);
  };
};

const subscribeConversationListSync = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getConversationListSyncSnapshot = (): ConversationListSyncSnapshot => snapshotState;

const refreshConversations = () => {
  void ipcBridge.database.getUserConversations
    .invoke({ limit: 10000 })
    .then((result) => {
      const items = result?.items;
      if (items && Array.isArray(items)) {
        const filteredData = items.filter((conv) => {
          // Legacy rows from the pre-provider-probe health check flow are hidden
          // from normal history. New health checks must not create conversations.
          const extra = conv.extra as { is_health_check?: boolean; team_id?: string; teamId?: string } | undefined;
          return extra?.is_health_check !== true && !extra?.team_id && !extra?.teamId;
        });
        conversationsState = filteredData;
        // Use ALL conversation IDs (including team/legacy health-check rows) so the
        // responseStream listener recognises them as known and doesn't
        // trigger an infinite refreshConversations loop.
        conversation_idsState = new Set(items.map((conversation) => conversation.id));
        emitStoreChange();
        return;
      }

      conversationsState = [];
      conversation_idsState = new Set();
      emitStoreChange();
    })
    .catch((error) => {
      console.error('[WorkspaceGroupedHistory] Failed to load conversations:', error);
      conversationsState = [];
      conversation_idsState = new Set();
      emitStoreChange();
    });
};

const markGenerating = (conversation_id: string) => {
  if (generatingConversationIdsState.has(conversation_id)) {
    return;
  }

  generatingConversationIdsState = new Set(generatingConversationIdsState).add(conversation_id);
  emitStoreChange();
};

const clearGenerating = (conversation_id: string) => {
  if (!generatingConversationIdsState.has(conversation_id)) {
    return;
  }

  const next = new Set(generatingConversationIdsState);
  next.delete(conversation_id);
  generatingConversationIdsState = next;
  emitStoreChange();
};

const getConversationDisplayName = (conversation_id: string): string | undefined => {
  return conversationsState.find((conversation) => conversation.id === conversation_id)?.name;
};

const markCompletionUnread = (conversation_id: string) => {
  const isNew = !completionUnreadConversationIdsState.has(conversation_id);
  if (isNew) {
    completionUnreadConversationIdsState = new Set(completionUnreadConversationIdsState).add(conversation_id);
    emitStoreChange();
  }

  if (shouldNotifyConversationAttention(conversation_id, activeConversationIdState)) {
    emitAttentionEvent({
      kind: 'completion',
      conversation_id,
      title: getConversationDisplayName(conversation_id),
    });
  }
};

const clearCompletionUnreadState = (conversation_id: string) => {
  if (!completionUnreadConversationIdsState.has(conversation_id)) {
    return;
  }

  const next = new Set(completionUnreadConversationIdsState);
  next.delete(conversation_id);
  completionUnreadConversationIdsState = next;
  emitStoreChange();
};

const markPermissionUnread = (conversation_id: string, attention?: Pick<ConversationAttentionEvent, 'title' | 'description'>) => {
  const nextCount = (permissionPendingCountsState.get(conversation_id) ?? 0) + 1;
  permissionPendingCountsState = new Map(permissionPendingCountsState);
  permissionPendingCountsState.set(conversation_id, nextCount);

  if (!permissionUnreadConversationIdsState.has(conversation_id)) {
    permissionUnreadConversationIdsState = new Set(permissionUnreadConversationIdsState).add(conversation_id);
    emitStoreChange();
  }

  if (shouldNotifyConversationAttention(conversation_id, activeConversationIdState)) {
    emitAttentionEvent({
      kind: 'permission',
      conversation_id,
      title: attention?.title ?? getConversationDisplayName(conversation_id),
      description: attention?.description,
    });
  }
};

const clearPermissionUnreadState = (conversation_id: string) => {
  permissionPendingCountsState = new Map(permissionPendingCountsState);
  permissionPendingCountsState.delete(conversation_id);

  if (!permissionUnreadConversationIdsState.has(conversation_id)) {
    return;
  }

  const next = new Set(permissionUnreadConversationIdsState);
  next.delete(conversation_id);
  permissionUnreadConversationIdsState = next;
  emitStoreChange();
};

const decrementPermissionPending = (conversation_id: string) => {
  const current = permissionPendingCountsState.get(conversation_id) ?? 0;
  if (current <= 1) {
    clearPermissionUnreadState(conversation_id);
    return;
  }

  permissionPendingCountsState = new Map(permissionPendingCountsState);
  permissionPendingCountsState.set(conversation_id, current - 1);
};

const markCompleted = (conversation_id: string) => {
  completedConversationIdsState = new Set(completedConversationIdsState).add(conversation_id);
};

const clearCompleted = (conversation_id: string) => {
  if (!completedConversationIdsState.has(conversation_id)) {
    return;
  }

  const next = new Set(completedConversationIdsState);
  next.delete(conversation_id);
  completedConversationIdsState = next;
};

const logLateStreamIgnored = (conversation_id: string, type: string) => {
  void ipcBridge.application.writeRendererLog
    .invoke({
      level: 'warn',
      tag: 'conversationRuntimeView',
      message: 'late_stream_ignored_for_runtime',
      data: {
        conversation_id,
        stream_type: type,
      },
    })
    .catch(() => {});
};

const setActiveConversationState = (conversation_id: string | null) => {
  activeConversationIdState = conversation_id;
};

export const initializeConversationListSyncStore = () => {
  if (isStoreInitialized) {
    return;
  }

  isStoreInitialized = true;

  if (typeof window !== 'undefined') {
    // HashRouter stores the virtual path in window.location.hash (e.g. "#/conversation/abc").
    // window.location.pathname is always "/" under HashRouter, so we must strip the "#" prefix.
    const hashPath = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.pathname;
    activeConversationIdState = parseActiveConversationIdFromPath(hashPath);
  }

  refreshConversations();

  addEventListener('chat.history.refresh', refreshConversations);
  ipcBridge.conversation.listChanged.on((event) => {
    if (event.action === 'deleted') {
      clearGenerating(event.conversation_id);
      clearCompletionUnreadState(event.conversation_id);
      clearPermissionUnreadState(event.conversation_id);
      clearCompleted(event.conversation_id);
    }
    refreshConversations();
  });
  ipcBridge.conversation.confirmation.add.on((confirmation) => {
    const conversation_id = confirmation.conversation_id;
    if (!conversation_id) {
      return;
    }

    if (shouldNotifyConversationAttention(conversation_id, activeConversationIdState)) {
      markPermissionUnread(conversation_id, {
        title: confirmation.title,
        description: confirmation.description,
      });
    }
  });
  ipcBridge.conversation.confirmation.remove.on(({ conversation_id }) => {
    if (!conversation_id) {
      return;
    }
    decrementPermissionPending(conversation_id);
  });
  ipcBridge.conversation.responseStream.on((message) => {
    const conversation_id = message.conversation_id;
    if (!conversation_id) {
      return;
    }

    if (!conversation_idsState.has(conversation_id)) {
      refreshConversations();
    }

    if (isTerminalStreamMessage(message)) {
      const wasGenerating = generatingConversationIdsState.has(conversation_id);
      if (wasGenerating && activeConversationIdState !== conversation_id) {
        markCompletionUnread(conversation_id);
      }
      clearGenerating(conversation_id);
      return;
    }

    const decision = getSidebarStreamGuardDecision({
      type: message.type,
      completed: completedConversationIdsState.has(conversation_id),
    });
    if (decision.clearCompleted) {
      clearCompleted(conversation_id);
    }
    if (decision.lateIgnored) {
      logLateStreamIgnored(conversation_id, message.type);
      return;
    }
    if (decision.markGenerating) {
      markGenerating(conversation_id);
    }
  });
  ipcBridge.conversation.turnCompleted.on((event) => {
    if (isTerminalTurnState(event.state) && activeConversationIdState !== event.session_id) {
      markCompletionUnread(event.session_id);
    }
    markCompleted(event.session_id);
    clearGenerating(event.session_id);
    refreshConversations();
  });
};

export const useConversationListSync = () => {
  useEffect(() => {
    initializeConversationListSyncStore();
  }, []);

  const { conversations, generatingConversationIds, completionUnreadConversationIds, permissionUnreadConversationIds } =
    useSyncExternalStore(subscribeConversationListSync, getConversationListSyncSnapshot, getConversationListSyncSnapshot);

  const clearCompletionUnread = useCallback((conversation_id: string) => {
    clearCompletionUnreadState(conversation_id);
  }, []);

  const clearPermissionUnread = useCallback((conversation_id: string) => {
    clearPermissionUnreadState(conversation_id);
  }, []);

  const setActiveConversation = useCallback((conversation_id: string | null) => {
    setActiveConversationState(conversation_id);
  }, []);

  const isConversationGenerating = useCallback(
    (conversation_id: string) => {
      return generatingConversationIds.has(conversation_id);
    },
    [generatingConversationIds]
  );

  const hasCompletionUnread = useCallback(
    (conversation_id: string) => {
      return completionUnreadConversationIds.has(conversation_id);
    },
    [completionUnreadConversationIds]
  );

  const hasPermissionUnread = useCallback(
    (conversation_id: string) => {
      return permissionUnreadConversationIds.has(conversation_id);
    },
    [permissionUnreadConversationIds]
  );

  const hasAttentionUnread = useCallback(
    (conversation_id: string) => {
      return (
        completionUnreadConversationIds.has(conversation_id) || permissionUnreadConversationIds.has(conversation_id)
      );
    },
    [completionUnreadConversationIds, permissionUnreadConversationIds]
  );

  return {
    conversations,
    isConversationGenerating,
    hasCompletionUnread,
    hasPermissionUnread,
    hasAttentionUnread,
    clearCompletionUnread,
    clearPermissionUnread,
    setActiveConversation,
  };
};
