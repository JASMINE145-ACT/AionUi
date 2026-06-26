import { describe, expect, it, vi } from 'vitest';
import { groupNormalizedToolCalls } from '@/common/chat/groupNormalizedToolCalls';
import type { NormalizedToolCall } from '@/common/chat/normalizeToolCall';

const tool = (partial: Partial<NormalizedToolCall> & Pick<NormalizedToolCall, 'key' | 'name'>): NormalizedToolCall => ({
  status: 'completed',
  ...partial,
});

describe('groupNormalizedToolCalls', () => {
  it('nests children under explicit parentToolUseId', () => {
    const tools = [
      tool({
        key: 'agent-1',
        name: 'Agent',
        isAgentDelegation: true,
        subagentLabel: 'quotation-agent',
      }),
      tool({ key: 'mcp-1', name: 'match_quotation', parentToolUseId: 'agent-1' }),
      tool({ key: 'mcp-2', name: 'get_price', parentToolUseId: 'agent-1' }),
    ];

    const { topLevel, childrenByParent } = groupNormalizedToolCalls(tools);

    expect(topLevel.map((item) => item.key)).toEqual(['agent-1']);
    expect(childrenByParent.get('agent-1')?.map((item) => item.key)).toEqual(['mcp-1', 'mcp-2']);
  });

  it('falls back to sequential nesting after Agent delegation when parent ids are missing', () => {
    const tools = [
      tool({
        key: 'agent-1',
        name: 'Agent',
        isAgentDelegation: true,
        subagentLabel: 'quotation-agent',
      }),
      tool({ key: 'read-1', name: 'Read SOP' }),
      tool({ key: 'mcp-1', name: 'match_quotation' }),
    ];

    const { topLevel, childrenByParent } = groupNormalizedToolCalls(tools);

    expect(topLevel.map((item) => item.key)).toEqual(['agent-1']);
    expect(childrenByParent.get('agent-1')?.map((item) => item.key)).toEqual(['read-1', 'mcp-1']);
  });

  it('keeps pre-agent tools at top level when no delegation happened', () => {
    const tools = [
      tool({ key: 'read-1', name: 'Read SOP' }),
      tool({ key: 'exec-1', name: 'ExecuteExtraTool' }),
    ];

    const { topLevel, childrenByParent } = groupNormalizedToolCalls(tools);

    expect(topLevel.map((item) => item.key)).toEqual(['read-1', 'exec-1']);
    expect(childrenByParent.size).toBe(0);
  });

  it('starts a new top-level group after the next Agent delegation', () => {
    const tools = [
      tool({ key: 'agent-1', name: 'Agent', isAgentDelegation: true, subagentLabel: 'quotation-agent' }),
      tool({ key: 'mcp-1', name: 'match_quotation' }),
      tool({ key: 'agent-2', name: 'Agent', isAgentDelegation: true, subagentLabel: 'accurate-agent' }),
      tool({ key: 'mcp-2', name: 'search_accurate' }),
    ];

    const { topLevel, childrenByParent } = groupNormalizedToolCalls(tools);

    expect(topLevel.map((item) => item.key)).toEqual(['agent-1', 'agent-2']);
    expect(childrenByParent.get('agent-1')?.map((item) => item.key)).toEqual(['mcp-1']);
    expect(childrenByParent.get('agent-2')?.map((item) => item.key)).toEqual(['mcp-2']);
  });

  it('prefers explicit parentToolUseId over sequential fallback for the same batch', () => {
    const tools = [
      tool({ key: 'agent-1', name: 'Agent', isAgentDelegation: true, subagentLabel: 'quotation-agent' }),
      tool({ key: 'mcp-1', name: 'match_quotation', parentToolUseId: 'agent-1' }),
      tool({ key: 'read-1', name: 'Read SOP' }),
    ];

    const { topLevel, childrenByParent } = groupNormalizedToolCalls(tools);

    expect(topLevel.map((item) => item.key)).toEqual(['agent-1']);
    expect(childrenByParent.get('agent-1')?.map((item) => item.key)).toEqual(['mcp-1', 'read-1']);
  });

  it('logs grouping diagnostics in development', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    groupNormalizedToolCalls([tool({ key: 'a', name: 'step' })]);

    expect(debugSpy).toHaveBeenCalledWith(
      '[toolCallGrouping]',
      expect.objectContaining({
        total: 1,
        topLevel: 1,
      })
    );

    process.env.NODE_ENV = previousNodeEnv;
    debugSpy.mockRestore();
  });
});
