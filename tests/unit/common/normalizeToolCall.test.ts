import { describe, expect, it } from 'vitest';
import type { IMessageAcpToolCall } from '@/common/chat/chatLib';
import { mergeAcpToolCallContent } from '@/common/chat/chatLib';
import { normalizeAcpToolCall, resolveAcpToolDisplayName } from '@/common/chat/normalizeToolCall';

describe('normalizeToolCall', () => {
  it('normalizes compact snake_case acp tool calls from history responses', () => {
    const result = normalizeAcpToolCall({
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
    } as unknown as IMessageAcpToolCall);

    expect(result).toMatchObject({
      key: 'tool-1',
      name: 'rg',
      status: 'completed',
      description: '"needle" in .',
      output: 'preview',
      truncated: true,
      messageId: 'message-1',
      conversationId: 'conversation-1',
    });
  });

  it('falls back when tool_call_update omits title (aioncore merge contract)', () => {
    const result = normalizeAcpToolCall({
      id: 'message-2',
      conversation_id: 'conversation-1',
      type: 'acp_tool_call',
      content: {
        update: {
          session_update: 'tool_call_update',
          tool_call_id: 'tool-2',
          status: 'completed',
          kind: 'read',
          raw_input: { file_path: '/tmp/active.json' },
        },
      },
    } as unknown as IMessageAcpToolCall);

    expect(result?.name).toBe('/tmp/active.json');
  });

  it('uses _meta.claudeCode.toolName when title missing', () => {
    const result = normalizeAcpToolCall({
      id: 'message-3',
      conversation_id: 'conversation-1',
      type: 'acp_tool_call',
      content: {
        _meta: { claudeCode: { toolName: 'mcp__org-knowledge__search_products' } },
        update: {
          session_update: 'tool_call_update',
          tool_call_id: 'tool-3',
          status: 'completed',
        },
      },
    } as unknown as IMessageAcpToolCall);

    expect(result?.name).toBe('mcp__org-knowledge__search_products');
  });

  it('reads parentToolUseId from _meta.claudeCode when raw_input omits it', () => {
    const result = normalizeAcpToolCall({
      id: 'message-4',
      conversation_id: 'conversation-1',
      type: 'acp_tool_call',
      content: {
        _meta: { claudeCode: { parentToolUseId: 'agent-parent-1', toolName: 'match_quotation' } },
        update: {
          session_update: 'tool_call_update',
          tool_call_id: 'tool-4',
          status: 'completed',
          kind: 'read',
        },
      },
    } as unknown as IMessageAcpToolCall);

    expect(result?.parentToolUseId).toBe('agent-parent-1');
  });

  it('resolveAcpToolDisplayName uses kind label as last resort', () => {
    expect(resolveAcpToolDisplayName({ kind: 'execute' })).toBe('Shell Command');
    expect(resolveAcpToolDisplayName({})).toBe('Tool');
  });
});

describe('mergeAcpToolCallContent', () => {
  it('preserves existing title when incoming update omits or blanks title', () => {
    const existing = {
      session_id: 'sess-1',
      update: {
        sessionUpdate: 'tool_call' as const,
        tool_call_id: 'tool-1',
        status: 'in_progress' as const,
        title: 'match_quotation',
        kind: 'read' as const,
      },
    };
    const incoming = {
      session_id: 'sess-1',
      update: {
        sessionUpdate: 'tool_call_update' as const,
        tool_call_id: 'tool-1',
        status: 'completed' as const,
        title: '',
        kind: 'read' as const,
      },
    };

    const merged = mergeAcpToolCallContent(existing, incoming);
    expect(merged.update.title).toBe('match_quotation');
  });
});
