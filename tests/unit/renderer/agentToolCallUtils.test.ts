import { describe, expect, it } from 'vitest';

import {
  extractAgentDelegationPrompt,
  getAgentDelegationLabel,
  isAgentDelegationToolCall,
} from '@/renderer/pages/conversation/Messages/acp/agentToolCallUtils';

describe('agentToolCallUtils', () => {
  it('detects Agent delegation by subagent_type', () => {
    expect(
      isAgentDelegationToolCall({ subagent_type: 'quotation-agent', prompt: '查直接50' }, 'Task')
    ).toBe(true);
  });

  it('detects Agent delegation by prompt and description', () => {
    expect(
      isAgentDelegationToolCall({ description: '报价查询', prompt: '查直接50' }, '报价查询')
    ).toBe(true);
  });

  it('rejects non-agent tool input', () => {
    expect(isAgentDelegationToolCall({ command: 'ls -la' }, 'Shell')).toBe(false);
  });

  it('extracts label and prompt', () => {
    const rawInput = { subagent_type: 'quotation-agent', prompt: '查直接50', description: '报价' };
    expect(getAgentDelegationLabel(rawInput, '报价')).toBe('quotation-agent');
    expect(extractAgentDelegationPrompt(rawInput)).toBe('查直接50');
  });
});
