/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { isWebUiBrowserMode } from '@/common/adapter/httpBridge';
import { ccbMcpService } from '@/common/adapter/ipcBridge';
import type { TMessage } from '@/common/chat/chatLib';
import {
  assertCcbSessionPreferredModeApplied,
  ensureCcbSessionPreferredMode,
} from '@/common/config/ensureCcbSessionPreferredMode';
import {
  getCcbSessionPreferredMode,
  seedCcbSessionPreferredMode,
} from '@/common/config/ccbSessionPreferredModeStore';
import type { TConversationRuntimeSummary } from '@/common/config/storage';
import { parseError, uuid } from '@/common/utils';
import { warmupConversation } from '@/renderer/pages/conversation/utils/warmupConversation';
import { emitter } from '@/renderer/utils/emitter';
import { buildDisplayMessage } from '@/renderer/utils/file/messageFiles';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getConversationRuntimeWorkspaceErrorMessage } from '../../utils/conversationCreateError';
import {
  claimAcpInitialMessage,
  clearAcpInitialMessage,
  releaseAcpInitialMessageClaim,
} from './acpPendingInitialMessage';
import { buildSendFailureError } from './buildSendFailureError';

type UseAcpInitialMessageParams = {
  conversation_id: string;
  backend: string;
  workspacePath?: string;
  setAiProcessing: (value: boolean) => void;
  resetState: () => void;
  markSendStarted?: () => void;
  markSendAccepted?: (turn_id: string, runtime: TConversationRuntimeSummary, msg_id?: string) => void;
  markSendFailed?: (reason: string) => void;
  initialModelId?: string;
  initialSessionMode?: string;
  ccbAuthorityActive?: boolean;
  checkAndUpdateTitle: (conversation_id: string, input: string) => void;
  addOrUpdateMessage: (message: TMessage, prepend?: boolean) => void;
};

/**
 * Side-effect-only hook that checks sessionStorage for an initial message
 * and sends it when the ACP conversation first mounts.
 */
export const useAcpInitialMessage = ({
  conversation_id,
  backend,
  workspacePath,
  setAiProcessing,
  resetState,
  markSendStarted,
  markSendAccepted,
  markSendFailed,
  initialModelId: _initialModelId,
  initialSessionMode,
  ccbAuthorityActive,
  checkAndUpdateTitle,
  addOrUpdateMessage,
}: UseAcpInitialMessageParams): void => {
  const { t } = useTranslation();

  useEffect(() => {
    const initialMessage = claimAcpInitialMessage(conversation_id);
    if (!initialMessage) return;

    const input = initialMessage.input;
    const files = Array.isArray(initialMessage.files) ? initialMessage.files : [];

    const sendInitialMessage = async () => {
      try {
        const displayMessage = buildDisplayMessage(input, files, workspacePath || '');

        markSendStarted?.();
        setAiProcessing(true);

        if (ccbAuthorityActive) {
          // WebUI: Electron MCP readiness IPC never resolves — skip; warmup handles ACP session.
          if (!isWebUiBrowserMode()) {
            await ccbMcpService.ensureStartupReadiness.invoke();
          }
          await warmupConversation(conversation_id);
          const preferredMode = getCcbSessionPreferredMode(
            conversation_id,
            initialSessionMode,
          )?.trim();
          if (preferredMode) {
            seedCcbSessionPreferredMode(conversation_id, preferredMode, backend);
            const modeResult = await ensureCcbSessionPreferredMode({
              conversation_id,
              preferredMode,
              backend,
            });
            assertCcbSessionPreferredModeApplied(modeResult, preferredMode, backend);
          }
        }

        void checkAndUpdateTitle(conversation_id, input);
        const result = await ipcBridge.acpConversation.sendMessage.invoke({
          input: displayMessage,
          conversation_id: conversation_id,
          files,
        });
        markSendAccepted?.(result.turn_id, result.runtime, result.msg_id);
        clearAcpInitialMessage(conversation_id);

        // Initial message sent successfully
        emitter.emit('chat.history.refresh');
      } catch (error) {
        releaseAcpInitialMessageClaim(conversation_id);
        const errorMessageText =
          getConversationRuntimeWorkspaceErrorMessage(error, t) || parseError(error) || t('common.unknownError');
        markSendFailed?.(errorMessageText);
        console.error('[useAcpInitialMessage] Error sending initial message:', error);
        console.error('[useAcpInitialMessage] Error details:', {
          name: (error as Error)?.name,
          message: errorMessageText,
          conversation_id,
        });

        const errorMessage: TMessage = {
          id: uuid(),
          msg_id: uuid(),
          conversation_id: conversation_id,
          type: 'tips',
          position: 'center',
          content: {
            content: errorMessageText,
            type: 'error',
            error: buildSendFailureError(error, errorMessageText),
          },
          created_at: Date.now() + 2,
        };
        addOrUpdateMessage(errorMessage, true);
        resetState();
        setAiProcessing(false); // Keep the prop-setter in sync with the hook reset
      }
    };

    sendInitialMessage().catch((error) => {
      console.error('Failed to send initial message:', error);
    });
  }, [
    addOrUpdateMessage,
    backend,
    ccbAuthorityActive,
    checkAndUpdateTitle,
    conversation_id,
    initialSessionMode,
    markSendAccepted,
    markSendFailed,
    markSendStarted,
    resetState,
    setAiProcessing,
    t,
    workspacePath,
  ]);
};
