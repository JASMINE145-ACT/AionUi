/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IMessageAcpToolCall, IMessagePlan } from '@/common/chat/chatLib';
import SubagentDrawer from '@/renderer/pages/conversation/Messages/acp/SubagentDrawer';

vi.mock('@renderer/components/Markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: { done?: number; total?: number }) => {
      if (key === 'conversation.plan.checklist.header') {
        return `${params?.done} of ${params?.total} Done`;
      }
      if (key === 'conversation.plan.drawer.sectionTitle') {
        return 'Execution plan';
      }
      return key;
    },
  }),
}));

const agentMessage: IMessageAcpToolCall = {
  id: 'agent-1',
  type: 'acp_tool_call',
  content: {
    update: {
      session_update: 'tool_call',
      tool_call_id: 'parent-tool-1',
      status: 'completed',
      title: 'Agent',
      kind: 'execute',
      rawInput: { subagent_type: 'research', prompt: 'Find news' },
      content: [],
    },
  },
} as IMessageAcpToolCall;

const turnPlanMessages: IMessagePlan[] = [
  {
    id: 'plan-1',
    type: 'plan',
    created_at: 100,
    content: {
      session_id: 'session-1',
      parentToolUseId: 'parent-tool-1',
      entries: [
        { content: 'Search sources', status: 'completed' },
        { content: 'Write report', status: 'in_progress' },
      ],
    },
  } as IMessagePlan,
];

describe('SubagentDrawer', () => {
  it('renders read-only delegation plan when turnPlanMessages match parent tool id', () => {
    render(
      <SubagentDrawer
        visible
        onClose={() => undefined}
        message={agentMessage}
        turnPlanMessages={turnPlanMessages}
      />,
    );

    expect(screen.getByTestId('subagent-drawer-plan')).toBeInTheDocument();
    expect(screen.getByText('Execution plan')).toBeInTheDocument();
    expect(screen.getByTestId('plan-checklist-header')).toHaveTextContent('1 of 2 Done');
    expect(screen.getByText('Write report')).toHaveClass('font-500');
  });

  it('omits plan section when no matching plan exists', () => {
    render(
      <SubagentDrawer visible onClose={() => undefined} message={agentMessage} turnPlanMessages={[]} />,
    );

    expect(screen.queryByTestId('subagent-drawer-plan')).not.toBeInTheDocument();
  });
});
