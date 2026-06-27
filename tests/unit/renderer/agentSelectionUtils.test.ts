import { describe, expect, it } from 'vitest';
import {
  filterPillBarAgents,
  findCcbClaudeAgent,
  isCcbExecutionEngineAgent,
} from '@/renderer/pages/guid/hooks/agentSelectionUtils';

describe('agentSelectionUtils CCB oracle helpers', () => {
  it('isCcbExecutionEngineAgent matches non-preset claude row', () => {
    expect(isCcbExecutionEngineAgent({ agent_type: 'acp', backend: 'claude' })).toBe(true);
    expect(isCcbExecutionEngineAgent({ agent_type: 'claude', backend: 'claude' })).toBe(true);
    expect(isCcbExecutionEngineAgent({ agent_type: 'acp', backend: 'gemini', is_preset: true })).toBe(false);
    expect(isCcbExecutionEngineAgent({ agent_type: 'acp', backend: 'gemini' })).toBe(false);
  });

  it('filterPillBarAgents keeps only claude execution engines', () => {
    const agents = [
      { agent_type: 'acp', backend: 'claude' },
      { agent_type: 'acp', backend: 'gemini' },
      { agent_type: 'acp', backend: 'codex' },
    ];
    expect(filterPillBarAgents(agents)).toEqual([{ agent_type: 'acp', backend: 'claude' }]);
  });

  it('findCcbClaudeAgent returns first claude row', () => {
    const found = findCcbClaudeAgent([
      { agent_type: 'acp', backend: 'gemini' },
      { agent_type: 'acp', backend: 'claude', id: 'ccb-wanding-route-b' },
    ]);
    expect(found?.backend).toBe('claude');
  });
});
