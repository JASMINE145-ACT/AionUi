import { describe, expect, it } from 'vitest';
import { buildDelegationRuns } from '@/common/chat/delegationRun';
import {
  assessDelegationSpawnObservability,
  assessTurnDelegationSpawn,
  isGuidDirectTurn,
  PATH_A_ORCHESTRATOR_SMOKE_TOOLS,
} from '@/common/chat/delegationSpawnContext';
import type { NormalizedToolCall } from '@/common/chat/normalizeToolCall';

const tool = (partial: Partial<NormalizedToolCall> & Pick<NormalizedToolCall, 'key' | 'name'>): NormalizedToolCall => ({
  status: 'completed',
  ...partial,
});

describe('delegationSpawnContext', () => {
  it('Path A smoke fixture is healthy with sequential child links', () => {
    const assessment = assessTurnDelegationSpawn(PATH_A_ORCHESTRATOR_SMOKE_TOOLS);

    expect(assessment.guidDirect).toBe(false);
    expect(assessment.runs).toHaveLength(1);
    expect(assessment.allHealthy).toBe(true);

    const run = buildDelegationRuns(PATH_A_ORCHESTRATOR_SMOKE_TOOLS)[0]!;
    expect(run.displayLabel).toBe('万鼎报价专家');
    expect(run.childAgentId).toBe('a7bef2f70cb5d93da');
    expect(run.childToolCount).toBe(2);
    expect(assessment.runs[0]?.childLinkMode).toBe('sequential-fallback');
  });

  it('detects explicit parentToolUseId child links', () => {
    const tools = [
      tool({ key: 'agent-1', name: 'Agent', isAgentDelegation: true, subagentLabel: 'quotation-agent' }),
      tool({
        key: 'mcp-1',
        name: 'match_quotation',
        parentToolUseId: 'agent-1',
      }),
    ];

    const report = assessDelegationSpawnObservability(buildDelegationRuns(tools)[0]!, tools);

    expect(report.childLinkMode).toBe('explicit-parent');
    expect(report.healthy).toBe(true);
  });

  it('marks Guid-direct turns without fake delegation', () => {
    const tools = [
      tool({ key: 'read-1', name: 'Read SOP' }),
      tool({ key: 'mcp-1', name: 'match_quotation' }),
    ];

    expect(isGuidDirectTurn(tools)).toBe(true);
    expect(assessTurnDelegationSpawn(tools)).toMatchObject({
      guidDirect: true,
      runs: [],
      allHealthy: true,
    });
  });

  it('flags orphan-mismatch when tool_uses present but no children', () => {
    const tools = [
      tool({
        key: 'agent-1',
        name: 'Agent',
        isAgentDelegation: true,
        subagentLabel: 'quotation-agent',
        output: JSON.stringify({ agentId: 'abc', tool_uses: 2 }),
      }),
    ];

    const report = assessDelegationSpawnObservability(buildDelegationRuns(tools)[0]!, tools);

    expect(report.childLinkMode).toBe('orphan-mismatch');
    expect(report.healthy).toBe(false);
    expect(report.issues.some((issue) => issue.includes('no nested child tools'))).toBe(true);
  });

  it('allows running delegation with no children yet', () => {
    const tools = [
      tool({
        key: 'agent-1',
        name: 'Agent',
        status: 'running',
        isAgentDelegation: true,
        subagentLabel: 'quotation-agent',
      }),
    ];

    const report = assessDelegationSpawnObservability(buildDelegationRuns(tools)[0]!, tools);

    expect(report.healthy).toBe(true);
    expect(report.issues.some((issue) => issue.includes('delegation running but no child tools'))).toBe(true);
  });

  it('records stable/dynamic/ephemeral field tiers', () => {
    const tools = [
      tool({
        key: 'agent-1',
        name: 'Agent',
        isAgentDelegation: true,
        subagentLabel: 'accurate-agent',
        input: '汇总本周账务差异',
        output: JSON.stringify({ agentId: 'acc-1', tool_uses: 1 }),
      }),
      tool({ key: 'mcp-1', name: 'accurate_summarize_records' }),
    ];

    const report = assessDelegationSpawnObservability(buildDelegationRuns(tools)[0]!, tools);
    const tiers = report.fields.map((field) => field.tier);

    expect(tiers).toContain('stable');
    expect(tiers).toContain('dynamic');
    expect(tiers).toContain('ephemeral');
    expect(report.fields.find((field) => field.key === 'delegation_prompt')?.present).toBe(true);
  });
});
