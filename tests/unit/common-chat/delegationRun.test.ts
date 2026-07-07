import { describe, expect, it } from 'vitest';
import {
  buildDelegationRuns,
  findDelegationRunForParent,
  formatDelegationHeader,
  getOrphanTopLevelTools,
  parseAgentOutputMeta,
  resolveDelegationDisplayLabel,
} from '@/common/chat/delegationRun';
import type { NormalizedToolCall } from '@/common/chat/normalizeToolCall';

const tool = (partial: Partial<NormalizedToolCall> & Pick<NormalizedToolCall, 'key' | 'name'>): NormalizedToolCall => ({
  status: 'completed',
  ...partial,
});

describe('parseAgentOutputMeta', () => {
  it('parses agentId and tool_uses from JSON output', () => {
    expect(
      parseAgentOutputMeta(JSON.stringify({ agentId: 'ada84162', tool_uses: 2, total_tokens: 100 }))
    ).toEqual({ agentId: 'ada84162', toolUses: 2 });
  });

  it('returns empty for missing output', () => {
    expect(parseAgentOutputMeta(undefined)).toEqual({});
  });
});

describe('resolveDelegationDisplayLabel', () => {
  it('maps known WanD agent ids', () => {
    expect(resolveDelegationDisplayLabel('quotation-agent')).toBe('万鼎报价专家');
  });

  it('uses custom resolver when provided', () => {
    expect(resolveDelegationDisplayLabel('custom-agent', () => 'Custom Label')).toBe('Custom Label');
  });
});

describe('buildDelegationRuns', () => {
  it('builds a done run with two nested children', () => {
    const tools = [
      tool({
        key: 'agent-1',
        name: 'Agent',
        isAgentDelegation: true,
        subagentLabel: 'quotation-agent',
        output: JSON.stringify({ agentId: 'abc123', tool_uses: 2 }),
      }),
      tool({ key: 'read-1', name: 'Read wanding_business_knowledge.md' }),
      tool({ key: 'mcp-1', name: 'mcp__quotation__match_quotation' }),
    ];

    const runs = buildDelegationRuns(tools);

    expect(runs).toHaveLength(1);
    expect(runs[0]?.subagentType).toBe('quotation-agent');
    expect(runs[0]?.displayLabel).toBe('万鼎报价专家');
    expect(runs[0]?.status).toBe('done');
    expect(runs[0]?.childToolCount).toBe(2);
    expect(runs[0]?.childAgentId).toBe('abc123');
    expect(runs[0]?.children.map((c) => c.key)).toEqual(['read-1', 'mcp-1']);
  });

  it('marks run running when agent is in progress', () => {
    const tools = [
      tool({
        key: 'agent-1',
        name: 'Agent',
        status: 'running',
        isAgentDelegation: true,
        subagentLabel: 'quotation-agent',
      }),
      tool({ key: 'read-1', name: 'Read SOP', status: 'completed' }),
      tool({ key: 'mcp-1', name: 'match_quotation', status: 'running' }),
    ];

    const runs = buildDelegationRuns(tools);

    expect(runs[0]?.status).toBe('running');
    expect(runs[0]?.completedChildCount).toBe(1);
    expect(runs[0]?.childToolCount).toBe(2);
  });

  it('marks run blocked when agent errored', () => {
    const tools = [
      tool({
        key: 'agent-1',
        name: 'Agent',
        status: 'error',
        isAgentDelegation: true,
        subagentLabel: 'accurate-agent',
      }),
    ];

    expect(buildDelegationRuns(tools)[0]?.status).toBe('blocked');
  });

  it('returns no runs for Guid-direct flat tools without Agent parent', () => {
    const tools = [
      tool({ key: 'read-1', name: 'Read SOP' }),
      tool({ key: 'mcp-1', name: 'match_quotation' }),
    ];

    expect(buildDelegationRuns(tools)).toHaveLength(0);
    expect(getOrphanTopLevelTools(tools).map((t) => t.key)).toEqual(['read-1', 'mcp-1']);
  });

  it('supports two delegation runs in one turn', () => {
    const tools = [
      tool({ key: 'agent-1', name: 'Agent', isAgentDelegation: true, subagentLabel: 'quotation-agent' }),
      tool({ key: 'mcp-1', name: 'match_quotation' }),
      tool({ key: 'agent-2', name: 'Agent', isAgentDelegation: true, subagentLabel: 'accurate-agent' }),
      tool({ key: 'mcp-2', name: 'accurate_summarize_records' }),
    ];

    const runs = buildDelegationRuns(tools);

    expect(runs).toHaveLength(2);
    expect(runs[0]?.children[0]?.key).toBe('mcp-1');
    expect(runs[1]?.children[0]?.key).toBe('mcp-2');
  });

  it('uses explicit parentToolUseId links', () => {
    const tools = [
      tool({ key: 'agent-1', name: 'Agent', isAgentDelegation: true, subagentLabel: 'quotation-agent' }),
      tool({ key: 'mcp-1', name: 'match_quotation', parentToolUseId: 'agent-1' }),
    ];

    expect(buildDelegationRuns(tools)[0]?.children.map((c) => c.key)).toEqual(['mcp-1']);
  });

  it('still builds a run when subagent_type is missing on Agent row', () => {
    const tools = [
      tool({ key: 'agent-1', name: 'Agent', isAgentDelegation: true }),
      tool({ key: 'read-1', name: 'Read SOP' }),
    ];

    const runs = buildDelegationRuns(tools);

    expect(runs).toHaveLength(1);
    expect(runs[0]?.displayLabel).toBe('子 Agent');
    expect(runs[0]?.children.map((c) => c.key)).toEqual(['read-1']);
    expect(getOrphanTopLevelTools(tools)).toHaveLength(0);
  });
});

describe('formatDelegationHeader', () => {
  it('formats done header with tool count', () => {
    const run = buildDelegationRuns([
      tool({
        key: 'agent-1',
        name: 'Agent',
        isAgentDelegation: true,
        subagentLabel: 'quotation-agent',
        output: JSON.stringify({ tool_uses: 2 }),
      }),
      tool({ key: 'a', name: 'step-1' }),
      tool({ key: 'b', name: 'step-2' }),
    ])[0]!;

    expect(formatDelegationHeader(run)).toBe('委派 → 万鼎报价专家 · done · 2 tools');
  });

  it('formats running header with progress fraction', () => {
    const run = buildDelegationRuns([
      tool({
        key: 'agent-1',
        name: 'Agent',
        status: 'running',
        isAgentDelegation: true,
        subagentLabel: 'quotation-agent',
      }),
      tool({ key: 'read-1', name: 'Read', status: 'completed' }),
      tool({ key: 'mcp-1', name: 'match', status: 'running' }),
    ])[0]!;

    expect(formatDelegationHeader(run)).toBe('委派 → 万鼎报价专家 · running · 1/2 tools');
  });
});

describe('findDelegationRunForParent', () => {
  it('returns the run matching parentToolUseId', () => {
    const tools = [
      tool({ key: 'agent-1', name: 'Agent', isAgentDelegation: true, subagentLabel: 'quotation-agent' }),
      tool({ key: 'mcp-1', name: 'match_quotation' }),
      tool({ key: 'agent-2', name: 'Agent', isAgentDelegation: true, subagentLabel: 'accurate-agent' }),
      tool({ key: 'mcp-2', name: 'accurate_summarize_records' }),
    ];

    const run = findDelegationRunForParent(tools, 'agent-2');

    expect(run?.subagentType).toBe('accurate-agent');
    expect(run?.children.map((c) => c.key)).toEqual(['mcp-2']);
  });

  it('returns undefined when parent id is unknown', () => {
    const tools = [
      tool({ key: 'agent-1', name: 'Agent', isAgentDelegation: true, subagentLabel: 'quotation-agent' }),
    ];

    expect(findDelegationRunForParent(tools, 'missing')).toBeUndefined();
  });
});
