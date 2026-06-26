/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessageAcpToolCall } from '@/common/chat/chatLib';
import MarkdownView from '@renderer/components/Markdown';
import { Drawer, Tag } from '@arco-design/web-react';
import React, { useMemo } from 'react';
import {
  extractAgentDelegationPrompt,
  getAgentDelegationLabel,
} from './agentToolCallUtils';

type SubagentDrawerProps = {
  visible: boolean;
  onClose: () => void;
  message: IMessageAcpToolCall;
};

const StatusTag: React.FC<{ status: string }> = ({ status }) => {
  const color =
    status === 'completed' ? 'green' : status === 'failed' ? 'red' : status === 'in_progress' ? 'orange' : 'blue';
  return <Tag color={color}>{status}</Tag>;
};

const SubagentDrawer: React.FC<SubagentDrawerProps> = ({ visible, onClose, message }) => {
  const { update } = message.content;
  const label = getAgentDelegationLabel(update.rawInput, update.title);
  const taskPrompt = extractAgentDelegationPrompt(update.rawInput);
  const outputBlocks = useMemo(() => update.content ?? [], [update.content]);

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
        <div className='text-sm text-t-secondary'>
          {update.status === 'in_progress' || update.status === 'pending'
            ? '子 Agent 正在执行…（嵌套工具流将在后续版本展示）'
            : '无额外输出内容。'}
        </div>
      )}

      <div className='text-xs text-t-secondary mt-4'>Tool Call ID: {update.tool_call_id}</div>
    </Drawer>
  );
};

export default SubagentDrawer;
