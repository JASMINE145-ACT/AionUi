import { describe, expect, it, vi, beforeEach } from 'vitest';

const { getAgentsMock, fetchAssistantsCatalogMock } = vi.hoisted(() => ({
  getAgentsMock: vi.fn(),
  fetchAssistantsCatalogMock: vi.fn(),
}));

vi.mock('@/renderer/hooks/agent/useAgents', () => ({
  getAgents: getAgentsMock,
}));

vi.mock('@/common/assistants/fetchAssistantsCatalog', () => ({
  fetchAssistantsCatalog: fetchAssistantsCatalogMock,
}));

import {
  channelAgentOptionToPersistPayload,
  loadChannelAgentOptions,
  matchSavedChannelAgent,
} from '@/renderer/components/settings/SettingsModal/contents/channels/channelAgentOptions';

describe('channelAgentOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges CCB preset assistants before CLI runtimes', async () => {
    getAgentsMock.mockResolvedValue([
      { id: 'claude-code', agent_type: 'acp', backend: 'claude', name: 'Claude Code', agent_source: 'builtin' },
      { id: 'codex-cli', agent_type: 'acp', backend: 'codex', name: 'Codex CLI', agent_source: 'builtin' },
      { id: 'aionrs', agent_type: 'aionrs', name: 'Aion CLI', agent_source: 'builtin' },
    ]);
    fetchAssistantsCatalogMock.mockResolvedValue([
      {
        id: 'quotation-agent',
        name: '万鼎报价专家',
        enabled: true,
        preset_agent_type: 'claude',
        source: 'builtin',
        name_i18n: {},
        description_i18n: {},
        context_i18n: {},
        prompts_i18n: {},
        sort_order: 100,
        enabled_skills: [],
        custom_skill_names: [],
        disabled_builtin_skills: [],
        prompts: [],
        models: [],
      },
    ]);

    const options = await loadChannelAgentOptions();

    expect(options[0]).toMatchObject({
      isPreset: true,
      custom_agent_id: 'quotation-agent',
      name: '万鼎报价专家',
      backend: 'claude',
      id: 'claude-code',
    });
    expect(options.some((o) => !o.isPreset && o.backend === 'codex')).toBe(true);
  });

  it('persists catalog engine id and preset assistant id separately for ACP routing', () => {
    const payload = channelAgentOptionToPersistPayload({
      key: 'preset:quotation-agent',
      agent_type: 'acp',
      backend: 'claude',
      id: 'claude-code',
      custom_agent_id: 'quotation-agent',
      name: '万鼎报价专家',
      isPreset: true,
    });

    expect(payload).toEqual({
      agent_type: 'acp',
      backend: 'claude',
      id: 'claude-code',
      custom_agent_id: 'quotation-agent',
      name: '万鼎报价专家',
    });
  });

  it('restores saved preset selection by custom_agent_id', () => {
    const options = [
      {
        key: 'preset:quotation-agent',
        agent_type: 'acp' as const,
        backend: 'claude',
        custom_agent_id: 'quotation-agent',
        name: '万鼎报价专家',
        isPreset: true,
      },
      {
        key: 'cli:acp:codex:codex-cli',
        agent_type: 'acp' as const,
        backend: 'codex',
        id: 'codex-cli',
        name: 'Codex CLI',
        isPreset: false,
      },
    ];

    const matched = matchSavedChannelAgent(options, {
      agent_type: 'acp',
      backend: 'claude',
      custom_agent_id: 'quotation-agent',
      name: '万鼎报价专家',
    });

    expect(matched?.key).toBe('preset:quotation-agent');
  });

  it('persists CLI runtime identity without preset assistant id', () => {
    const payload = channelAgentOptionToPersistPayload({
      key: 'cli:acp:codex:codex-cli',
      agent_type: 'acp',
      backend: 'codex',
      id: 'codex-cli',
      name: 'Codex CLI',
      isPreset: false,
    });

    expect(payload).toEqual({
      agent_type: 'acp',
      backend: 'codex',
      id: 'codex-cli',
      custom_agent_id: 'codex-cli',
      name: 'Codex CLI',
    });
  });

  it('restores saved CLI selection by agent_type and backend', () => {
    const options = [
      {
        key: 'cli:aionrs::aionrs',
        agent_type: 'aionrs' as const,
        id: 'aionrs',
        name: 'Aion CLI',
        isPreset: false,
      },
      {
        key: 'cli:acp:codex:codex-cli',
        agent_type: 'acp' as const,
        backend: 'codex',
        id: 'codex-cli',
        name: 'Codex CLI',
        isPreset: false,
      },
    ];

    const matched = matchSavedChannelAgent(options, {
      agent_type: 'acp',
      backend: 'codex',
      name: 'Codex CLI',
    });

    expect(matched?.key).toBe('cli:acp:codex:codex-cli');
  });
});
