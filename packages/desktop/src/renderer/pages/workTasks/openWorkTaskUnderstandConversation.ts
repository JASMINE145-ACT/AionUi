/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Open a new ACP conversation so an agent can understand a work task (not execute).
 */

import { ipcBridge } from '@/common';
import { ccbModelService } from '@/common/adapter/ipcBridge';
import type { WorkTask } from '@/common/types/workTasks/workTaskTypes';
import {
  buildCcbPresetConversationExtra,
  stageCcbAssistantProfileForSession,
} from '@/common/utils/ccbPresetConversationExtra';
import {
  appendWorkTaskAgentBriefPath,
  buildWorkTaskUnderstandPrompt,
  resolveWorkTaskUnderstandDefaultAgentId,
  WORK_TASK_UNDERSTAND_SESSION_MODE,
} from '@/common/workTasks/workTaskOpenAgent';
import { setCcbSessionPreferredMode } from '@/common/config/ccbSessionPreferredModeStore';
import { stageAcpInitialMessage } from '@/renderer/pages/conversation/platforms/acp/acpPendingInitialMessage';
import { emitter } from '@/renderer/utils/emitter';

export type OpenWorkTaskUnderstandResult = {
  conversationId: string;
  writebackOk: boolean;
  writebackSkipped: boolean;
};

export async function openWorkTaskUnderstandConversation(params: {
  task: WorkTask;
  agentId?: string;
  agentLabel?: string;
}): Promise<OpenWorkTaskUnderstandResult> {
  const agentId = resolveWorkTaskUnderstandDefaultAgentId(params.agentId);
  const prompt = buildWorkTaskUnderstandPrompt({ task: params.task, agentId });
  const conversationName = `了解: ${params.task.title}`.slice(0, 80);

  const ccbAuthorityActive = await ccbModelService.isAuthorityActive.invoke().catch(() => false);
  const ccbPresetExtra = await buildCcbPresetConversationExtra(agentId, ccbAuthorityActive);

  const conversation = await ipcBridge.conversation.create.invoke({
    type: 'acp',
    name: conversationName,
    model: {
      id: 'default',
      name: 'Default',
      use_model: 'default',
      platform: 'custom',
      base_url: '',
      api_key: '',
    },
    extra: {
      workspace: '',
      custom_workspace: false,
      backend: 'claude',
      ...ccbPresetExtra,
      session_mode: WORK_TASK_UNDERSTAND_SESSION_MODE,
    },
  });
  if (!conversation?.id) {
    throw new Error('conversation_create_failed');
  }

  if (ccbAuthorityActive) {
    await stageCcbAssistantProfileForSession(agentId);
  }

  setCcbSessionPreferredMode(conversation.id, WORK_TASK_UNDERSTAND_SESSION_MODE);
  stageAcpInitialMessage(conversation.id, { input: prompt, files: [] });
  emitter.emit('chat.history.refresh');

  const { description, appended } = appendWorkTaskAgentBriefPath(params.task.description, {
    conversationId: conversation.id,
    agentId,
    agentLabel: params.agentLabel ?? agentId,
  });

  let writebackOk = true;
  if (appended) {
    try {
      await ipcBridge.workTask.updateTask.invoke({
        task_id: params.task.id,
        updates: { description },
      });
    } catch (error) {
      writebackOk = false;
      console.warn('[openWorkTaskUnderstandConversation] brief path writeback failed', error);
    }
  }

  return {
    conversationId: conversation.id,
    writebackOk,
    writebackSkipped: !appended,
  };
}
