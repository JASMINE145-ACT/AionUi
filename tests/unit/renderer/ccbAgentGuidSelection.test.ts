import { describe, expect, it } from 'vitest';

import { resolveCcbAgentGuidSelectionKey } from '@/renderer/pages/settings/AgentSettings/CcbWandingAgentsPanel';
import type { CcbAgentRecord } from '@/common/config/ccbAgents';

function agent(overrides: Partial<CcbAgentRecord>): CcbAgentRecord {
  return {
    id: 'quotation-agent',
    name: 'quotation-agent',
    source: 'bundled',
    enabled: true,
    schema_version: 1,
    skills: { enabled: [], disabled: [] },
    mcp_allowlist: [],
    recommended_prompts: [],
    ...overrides,
  } as CcbAgentRecord;
}

describe('resolveCcbAgentGuidSelectionKey', () => {
  it('selects CCB preset assistants through the assistant handoff path', () => {
    expect(
      resolveCcbAgentGuidSelectionKey(
        agent({
          id: 'quotation-agent',
          guid_primary: true,
        })
      )
    ).toBe('custom:quotation-agent');
  });

  it('selects the hidden default router as the base CCB session agent', () => {
    expect(
      resolveCcbAgentGuidSelectionKey(
        agent({
          id: 'wande-orchestrator',
          name: 'wande-orchestrator',
        })
      )
    ).toBe('claude');
  });

  it('does not route disabled CCB agents through preset assistant selection', () => {
    expect(
      resolveCcbAgentGuidSelectionKey(
        agent({
          id: 'disabled-agent',
          enabled: false,
          guid_primary: true,
        })
      )
    ).toBe('claude');
  });
});
