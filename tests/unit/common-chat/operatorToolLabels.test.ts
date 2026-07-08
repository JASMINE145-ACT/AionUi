import { describe, expect, it } from 'vitest';
import { formatOperatorToolLabel } from '@/common/chat/operatorToolLabels';
import type { NormalizedToolCall } from '@/common/chat/normalizeToolCall';

const tool = (partial: Partial<NormalizedToolCall> & Pick<NormalizedToolCall, 'key' | 'name'>): NormalizedToolCall => ({
  status: 'completed',
  ...partial,
});

describe('formatOperatorToolLabel', () => {
  it('maps knowledge Read to operator label', () => {
    expect(formatOperatorToolLabel(tool({ key: 'r1', name: 'Read wanding_business_knowledge.md' }))).toBe(
      'Read 业务知识库',
    );
  });

  it('maps match_quotation MCP to operator label', () => {
    expect(formatOperatorToolLabel(tool({ key: 'm1', name: 'mcp__quotation__match_quotation' }))).toBe('查价 MCP');
  });

  it('falls back to tool name', () => {
    expect(formatOperatorToolLabel(tool({ key: 'x1', name: 'rg', description: 'pattern search' }))).toBe('rg');
  });
});
