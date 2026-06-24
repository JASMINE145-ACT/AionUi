/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IConversationMcpStatus } from '@/common/config/storage';
import { ConversationProvider } from '@/renderer/hooks/context/ConversationContext';
import { useTeamPermission } from '@/renderer/pages/team/hooks/TeamPermissionContext';
import FlexFullContainer from '@renderer/components/layout/FlexFullContainer';
import MessageList from '@renderer/pages/conversation/Messages/MessageList';
import { ConversationArtifactProvider } from '@renderer/pages/conversation/Messages/artifacts';
import {
  MessageListLoadingProvider,
  MessageListProvider,
  useMessageLstCache,
  useMessageList,
} from '@renderer/pages/conversation/Messages/hooks';
import { usePendingConfirmationsRecovery } from '@renderer/pages/conversation/Messages/usePendingConfirmationsRecovery';
import HOC from '@renderer/utils/ui/HOC';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AcpE2EStreamInjector from './AcpE2EStreamInjector';
import AcpSendBox from './AcpSendBox';
import { useAcpMessage } from './useAcpMessage';
import { useConversationRuntimeView } from '@renderer/pages/conversation/runtime/useConversationRuntimeView';
import type { IMessageText } from '@/common/chat/chatLib';

const AcpChat: React.FC<{
  conversation_id: string;
  workspace?: string;
  backend: string;
  session_mode?: string;
  agent_name?: string;
  cron_job_id?: string;
  hideSendBox?: boolean;
  emptySlot?: React.ReactNode;
  loadedSkills?: string[];
  loadedMcpServers?: string[];
  loadedMcpStatuses?: IConversationMcpStatus[];
  assistantId?: string;
  initialModelId?: string;
}> = ({
  conversation_id,
  workspace,
  backend,
  session_mode,
  agent_name,
  cron_job_id,
  hideSendBox,
  emptySlot,
  loadedSkills,
  loadedMcpServers,
  loadedMcpStatuses,
  assistantId,
  initialModelId,
}) => {
  useMessageLstCache(conversation_id);
  usePendingConfirmationsRecovery(conversation_id);
  const teamPermission = useTeamPermission();
  const messageState = useAcpMessage(conversation_id, { skipWarmup: Boolean(teamPermission) });
  const isReconnecting = messageState.hasHydratedRunningState && messageState.acpStatus === 'connecting';

  const runtimeView = useConversationRuntimeView(conversation_id);
  const messages = useMessageList();
  const lastUserPromptRef = useRef<string | null>(null);
  const sendHandlerRef = useRef<((msg: string) => Promise<void>) | null>(null);
  const [showInterruptedBanner, setShowInterruptedBanner] = useState(false);

  const handleLastUserPromptChange = useCallback((text: string) => {
    lastUserPromptRef.current = text;
    setShowInterruptedBanner(false);
  }, []);

  useEffect(() => {
    if (runtimeView.isProcessing) {
      setShowInterruptedBanner(false);
      return;
    }
    const lastAssistant = [...messages].reverse().find(
      (m) => m.type === 'text' && m.position !== 'right'
    ) as IMessageText | undefined;
    if (!lastAssistant) {
      setShowInterruptedBanner(false);
      return;
    }
    const text = lastAssistant.content?.content ?? '';
    const isInterrupted = text.includes('[Tool use interrupted]');
    setShowInterruptedBanner(isInterrupted && lastUserPromptRef.current !== null);
  }, [messages, runtimeView.isProcessing]);

  const handleRetry = useCallback(() => {
    const prompt = lastUserPromptRef.current;
    if (!prompt || !sendHandlerRef.current) {
      return;
    }
    setShowInterruptedBanner(false);
    void sendHandlerRef.current(prompt);
  }, []);

  const handleSendHandlerReady = useCallback((fn: (msg: string) => Promise<void>) => {
    sendHandlerRef.current = fn;
  }, []);

  return (
    <ConversationProvider
      value={{
        conversation_id: conversation_id,
        workspace,
        type: 'acp',
        cron_job_id,
        hideSendBox,
        loadedSkills,
        loadedMcpServers,
        loadedMcpStatuses,
        assistantId,
        initialModelId,
      }}
    >
      <ConversationArtifactProvider conversation_id={conversation_id}>
        <div className='flex-1 flex flex-col px-20px min-h-0'>
          <FlexFullContainer>
            <MessageList
              className='flex-1'
              emptySlot={emptySlot}
              interruptedBanner={{
                show: showInterruptedBanner,
                lastUserPrompt: lastUserPromptRef.current,
                onRetry: handleRetry,
              }}
            />
          </FlexFullContainer>
          {isReconnecting && (
            <div className='text-xs text-t-secondary text-center py-1 px-3 mb-1 rounded'
              style={{ background: 'var(--color-fill-2)' }}>
              正在重新连接，请稍候…
            </div>
          )}
          <AcpE2EStreamInjector conversationId={conversation_id} />
          {!hideSendBox && (
            <AcpSendBox
              conversation_id={conversation_id}
              backend={backend}
              session_mode={session_mode}
              agent_name={agent_name}
              workspacePath={workspace}
              messageState={messageState}
              onLastUserPromptChange={handleLastUserPromptChange}
              onSendHandlerReady={handleSendHandlerReady}
            ></AcpSendBox>
          )}
        </div>
      </ConversationArtifactProvider>
    </ConversationProvider>
  );
};

export default HOC.Wrapper(MessageListProvider, MessageListLoadingProvider)(AcpChat);
