import { describe, expect, it } from 'vitest';
import type { TChatConversation } from '@/common/config/storage';
import { resolvePresetId } from '@/renderer/hooks/agent/usePresetAssistantInfo';

function conversation(extra: Record<string, unknown>): TChatConversation {
  return {
    id: 'c-test',
    name: 'test',
    type: 'acp',
    extra,
  } as TChatConversation;
}

describe('resolvePresetId — CCB agent id', () => {
  it('reads ccb_agent_id for sidebar avatar lookup', () => {
    expect(
      resolvePresetId(
        conversation({
          ccb_agent_id: 'quotation-agent',
          ccb_assistant_profile_id: 'quotation-agent',
        })
      )
    ).toBe('quotation-agent');
  });

  it('reads acp_meta.ccbAgentId when ccb_agent_id is absent', () => {
    expect(
      resolvePresetId(
        conversation({
          acp_meta: {
            ccbAgentId: 'ppt-creator',
            preset_assistant_id: 'ppt-creator',
          },
        })
      )
    ).toBe('ppt-creator');
  });

  it('prefers ccb_agent_id over generic custom_agent_id', () => {
    expect(
      resolvePresetId(
        conversation({
          ccb_agent_id: 'quotation-agent',
          custom_agent_id: 'claude',
        })
      )
    ).toBe('quotation-agent');
  });
});
