import { describe, expect, it } from 'vitest';

import { agentIdLookupCandidates, normalizeAgentId } from '@/common/config/ccbAgentIdShared';
import { normalizeCcbAssistantProfileId } from '@/common/config/ccbAssistantProfiles';

describe('ccbAgentIdShared', () => {
  it('normalizes agent ids the same way as assistant profile ids', () => {
    expect(normalizeAgentId(' Quotation Assistant!! ')).toBe('quotation-assistant');
    expect(normalizeAgentId(' Quotation Assistant!! ')).toBe(
      normalizeCcbAssistantProfileId(' Quotation Assistant!! ')
    );
  });

  it('builds lookup candidates with builtin prefix aliases', () => {
    expect(agentIdLookupCandidates('builtin-quotation-agent')).toEqual(
      expect.arrayContaining(['builtin-quotation-agent', 'quotation-agent'])
    );
  });
});
