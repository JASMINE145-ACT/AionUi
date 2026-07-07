import { describe, expect, it } from 'vitest';
import type { TChatConversation } from '@/common/config/storage';
import {
  resolvePresetId,
  resolveSidebarPresetLookupId,
} from '@/renderer/hooks/agent/usePresetAssistantInfo';

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

describe('resolveSidebarPresetLookupId — CCB default route', () => {
  it('infers wande-orchestrator for legacy claude ACP sessions when CCB authority is active', () => {
    expect(
      resolveSidebarPresetLookupId(
        conversation({
          backend: 'claude',
        }),
        { ccbAuthorityActive: true }
      )
    ).toBe('wande-orchestrator');
  });

  it('does not infer orchestrator when ccb_agent_id is already present', () => {
    expect(
      resolveSidebarPresetLookupId(
        conversation({
          ccb_agent_id: 'quotation-agent',
        }),
        { ccbAuthorityActive: true }
      )
    ).toBe('quotation-agent');
  });

  it('does not infer orchestrator for non-claude backends', () => {
    expect(
      resolveSidebarPresetLookupId(
        conversation({
          backend: 'gemini',
        }),
        { ccbAuthorityActive: true }
      )
    ).toBeNull();
  });

  it('does not infer orchestrator when CCB authority is inactive', () => {
    expect(
      resolveSidebarPresetLookupId(
        conversation({
          backend: 'claude',
        }),
        { ccbAuthorityActive: false }
      )
    ).toBeNull();
  });

  it('does not infer orchestrator when agent_id is present', () => {
    expect(
      resolveSidebarPresetLookupId(
        conversation({
          backend: 'claude',
          agent_id: 'claude-cli-1',
        }),
        { ccbAuthorityActive: true }
      )
    ).toBeNull();
  });

  it('does not infer orchestrator for aionrs conversation type', () => {
    expect(
      resolveSidebarPresetLookupId(
        {
          id: 'c-aionrs',
          name: 'test',
          type: 'aionrs',
          extra: {},
        } as TChatConversation,
        { ccbAuthorityActive: true }
      )
    ).toBeNull();
  });
});
