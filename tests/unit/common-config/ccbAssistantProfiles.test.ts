import { describe, expect, it } from 'vitest';

import {
  normalizeCcbAssistantProfile,
  normalizeCcbAssistantProfileId,
} from '@/common/config/ccbAssistantProfiles';

describe('ccbAssistantProfiles', () => {
  it('normalizes profile ids for CCB config storage', () => {
    expect(normalizeCcbAssistantProfileId(' Quotation Assistant!! ')).toBe('quotation-assistant');
  });

  it('normalizes assistant profile defaults', () => {
    const profile = normalizeCcbAssistantProfile({
      id: 'quote',
      name: 'Quote',
      instructions: {
        system_prompt: 'Quote system',
        claude_md: 'Quote CLAUDE.md',
      },
      defaults: {
        model: 'glm-5.1',
        permission_mode: 'plan',
        skills: { enabled: ['quote-helper'] },
        mcp: { enabled: ['quotation'], disabled: ['excel-mcp'] },
      },
    });

    expect(profile?.instructions.claude_md).toBe('Quote CLAUDE.md');
    expect(profile?.defaults.skills.enabled).toEqual(['quote-helper']);
    expect(profile?.defaults.mcp.enabled).toEqual(['quotation']);
    expect(profile?.defaults.mcp.disabled).toEqual(['excel-mcp']);
  });
});
