import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ipcBridge } from '@/common';
import type { TMessage } from '@/common/chat/chatLib';
import type { ToolMessage } from '@/common/chat/normalizeToolCall';
import MessageToolGroupSummary from '@/renderer/pages/conversation/Messages/components/MessageToolGroupSummary';

vi.mock('@/common', () => ({
  ipcBridge: {
    database: {
      getConversationMessage: {
        invoke: vi.fn(),
      },
    },
  },
}));

vi.mock('@renderer/components/Markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('MessageToolGroupSummary', () => {
  it('loads full tool content when expanding a compact history item', async () => {
    const invoke = vi.mocked(ipcBridge.database.getConversationMessage.invoke);
    invoke.mockResolvedValue({
      id: 'message-1',
      conversation_id: 'conversation-1',
      type: 'acp_tool_call',
      content: {
        update: {
          session_update: 'tool_call',
          tool_call_id: 'tool-1',
          status: 'completed',
          title: 'rg',
          kind: 'search',
          raw_input: { pattern: 'needle', path: '.' },
          content: [{ type: 'content', content: { type: 'text', text: 'full output' } }],
        },
      },
    } as unknown as TMessage);

    render(
      <MessageToolGroupSummary
        messages={[
          {
            id: 'message-1',
            conversation_id: 'conversation-1',
            type: 'acp_tool_call',
            content: {
              _compact: {
                truncated: true,
                original_size: 90000,
                preview_chars: 4096,
              },
              update: {
                session_update: 'tool_call',
                tool_call_id: 'tool-1',
                status: 'completed',
                title: 'rg',
                kind: 'search',
                raw_input: { pattern: 'needle', path: '.' },
                content: [{ type: 'content', content: { type: 'text', text: 'preview' } }],
              },
            },
          } as unknown as ToolMessage,
        ]}
      />
    );

    fireEvent.click(screen.getByText('View Steps · 1'));
    fireEvent.click(screen.getByText('rg'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith({
        conversation_id: 'conversation-1',
        message_id: 'message-1',
      });
    });
    expect(await screen.findByText('full output')).toBeInTheDocument();
  });

  it('opens SubagentDrawer with nested timeline for delegation runs', () => {
    render(
      <MessageToolGroupSummary
        messages={[
          {
            id: 'agent-msg',
            conversation_id: 'conversation-1',
            type: 'acp_tool_call',
            content: {
              update: {
                tool_call_id: 'agent-1',
                status: 'completed',
                title: 'Agent',
                kind: 'agent',
                rawInput: { subagent_type: 'quotation-agent', prompt: '查直接50价格' },
                content: [
                  {
                    type: 'content',
                    content: { type: 'text', text: JSON.stringify({ agentId: 'abc123', tool_uses: 2 }) },
                  },
                ],
              },
            },
          },
          {
            id: 'read-msg',
            conversation_id: 'conversation-1',
            type: 'acp_tool_call',
            content: {
              _meta: { claudeCode: { parentToolUseId: 'agent-1' } },
              update: {
                tool_call_id: 'read-1',
                status: 'completed',
                title: 'Read wanding_business_knowledge.md',
                kind: 'read',
              },
            },
          },
          {
            id: 'mcp-msg',
            conversation_id: 'conversation-1',
            type: 'acp_tool_call',
            content: {
              _meta: { claudeCode: { parentToolUseId: 'agent-1' } },
              update: {
                tool_call_id: 'mcp-1',
                status: 'completed',
                title: 'mcp__quotation__match_quotation',
                kind: 'execute',
              },
            },
          },
        ] as unknown as ToolMessage[]}
      />,
    );

    fireEvent.click(screen.getByText('View Steps · 1'));
    fireEvent.click(screen.getByText('查看执行'));

    expect(screen.getByText('子 Agent 执行')).toBeInTheDocument();
    expect(screen.getAllByText('Read 业务知识库').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('查价 MCP').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('子会话 agentId: abc123')).toBeInTheDocument();
  });
});
