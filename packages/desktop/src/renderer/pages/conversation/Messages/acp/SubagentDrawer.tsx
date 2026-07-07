/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessageAcpToolCall } from '@/common/chat/chatLib';
import {
  findDelegationRunForParent,
  formatDelegationHeader,
  parseAgentOutputMeta,
  resolveDelegationDisplayLabel,
} from '@/common/chat/delegationRun';
import { normalizeToolMessages, type ToolMessage } from '@/common/chat/normalizeToolCall';
import MarkdownView from '@renderer/components/Markdown';
import { Drawer, Tag } from '@arco-design/web-react';
import React, { useMemo } from 'react';
import DelegationRunChildSteps from '../components/DelegationRunChildSteps';
import '../components/MessageToolGroupSummary.css';
import {
  extractAgentDelegationPrompt,
  getAgentDelegationLabel,
} from './agentToolCallUtils';

type SubagentDrawerProps = {
  visible: boolean;
  onClose: () => void;
  message: IMessageAcpToolCall;
  /** Same-turn tool messages — enables nested timeline via buildDelegationRuns. */
  turnToolMessages?: ToolMessage[];
};

const StatusTag: React.FC<{ status: string }> = ({ status }) => {
  const color =
    status === 'completed' ? 'green' : status === 'failed' ? 'red' : status === 'in_progress' ? 'orange' : 'blue';
  return <Tag color={color}>{status}</Tag>;
};

const mapAcpStatus = (status: string): 'completed' | 'error' | 'running' | 'pending' | 'canceled' => {
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'error';
  if (status === 'in_progress') return 'running';
  if (status === 'pending') return 'pending';
  return 'running';
};

const SubagentDrawer: React.FC<SubagentDrawerProps> = ({ visible, onClose, message, turnToolMessages }) => {
  const { update } = message.content;
  const subagentType = getAgentDelegationLabel(update.rawInput, update.title);
  const label = resolveDelegationDisplayLabel(subagentType);
  const taskPrompt = extractAgentDelegationPrompt(update.rawInput);
  const outputBlocks = useMemo(() => update.content ?? [], [update.content]);
  const outputText = useMemo(
    () =>
      outputBlocks
        .map((block) => (block.type === 'content' && block.content?.type === 'text' ? block.content.text : ''))
        .filter(Boolean)
        .join('\n'),
    [outputBlocks],
  );
  const outputMeta = useMemo(() => parseAgentOutputMeta(outputText), [outputText]);

  const delegationRun = useMemo(() => {
    if (!turnToolMessages?.length) return undefined;
    const tools = normalizeToolMessages(turnToolMessages);
    return findDelegationRunForParent(tools, update.tool_call_id);
  }, [turnToolMessages, update.tool_call_id]);

  const headerSummary = useMemo(() => {
    if (delegationRun) return formatDelegationHeader(delegationRun);

    const runStatus =
      update.status === 'failed' ? 'blocked' : update.status === 'completed' ? 'done' : 'running';
    return formatDelegationHeader({
      parentToolUseId: update.tool_call_id,
      subagentType,
      displayLabel: label,
      childAgentId: outputMeta.agentId,
      childToolCount: outputMeta.toolUses ?? 0,
      completedChildCount: update.status === 'completed' ? outputMeta.toolUses ?? 0 : 0,
      status: runStatus,
      children: [],
      agentTool: {
        key: update.tool_call_id,
        name: 'Agent',
        status: mapAcpStatus(update.status),
      },
    });
  }, [delegationRun, update, subagentType, label, outputMeta]);

  const childAgentId = delegationRun?.childAgentId ?? outputMeta.agentId;
  const nestedChildren = delegationRun?.children ?? [];

  return (
    <Drawer
      width={480}
      title={
        <div className='flex items-center gap-2'>
          <span>子 Agent 执行</span>
          <Tag color='arcoblue'>{label}</Tag>
          <StatusTag status={update.status} />
        </div>
      }
      visible={visible}
      onCancel={onClose}
      footer={null}
    >
      <section className='mb-4'>
        <div className='text-sm font-medium text-t-primary mb-2'>委派状态</div>
        <div className='bg-1 p-3 rounded border text-sm'>{headerSummary}</div>
        {childAgentId && (
          <div className='text-xs text-t-secondary mt-2'>子会话 agentId: {childAgentId}</div>
        )}
      </section>

      {nestedChildren.length > 0 && (
        <section className='mb-4'>
          <div className='text-sm font-medium text-t-primary mb-2'>嵌套工具链</div>
          <DelegationRunChildSteps children={nestedChildren} />
        </section>
      )}

      {taskPrompt && (
        <section className='mb-4'>
          <div className='text-sm font-medium text-t-primary mb-2'>委派任务</div>
          <div className='bg-1 p-3 rounded border'>
            <MarkdownView>{taskPrompt}</MarkdownView>
          </div>
        </section>
      )}

      {outputBlocks.length > 0 ? (
        <section>
          <div className='text-sm font-medium text-t-primary mb-2'>执行输出</div>
          {outputBlocks.map((block, index) => {
            if (block.type === 'content' && block.content?.type === 'text' && block.content.text) {
              return (
                <div key={index} className='bg-1 p-3 rounded border mb-2'>
                  <MarkdownView>{block.content.text}</MarkdownView>
                </div>
              );
            }
            return null;
          })}
        </section>
      ) : (
        nestedChildren.length === 0 && (
          <div className='text-sm text-t-secondary'>
            {update.status === 'in_progress' || update.status === 'pending'
              ? '子 Agent 正在执行…展开 View Steps 可查看嵌套工具链。'
              : '无额外输出内容。'}
          </div>
        )
      )}

      <div className='text-xs text-t-secondary mt-4'>Tool Call ID: {update.tool_call_id}</div>
    </Drawer>
  );
};

export default SubagentDrawer;
