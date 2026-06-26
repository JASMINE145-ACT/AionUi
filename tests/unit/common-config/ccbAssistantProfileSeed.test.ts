import { describe, expect, it } from 'vitest';

import {
  assistantDetailToProfileSeed,
  assistantListRowToProfileSeed,
  buildBundledCcbAssistantProfile,
} from '@/common/config/ccbAssistantProfileSeedShared';
import type { Assistant, AssistantDetail } from '@/common/types/agent/assistantTypes';
import { resolveCcbPresetAgentType } from '@/common/config/ccbWandingRuntime';

describe('ccbAssistantProfileSeedShared', () => {
  it('builds bundled profile from assistant detail seed input', () => {
    const profile = buildBundledCcbAssistantProfile({
      id: 'word-creator',
      name: 'Word 文档助手',
      rulesContent: 'You create Word documents.',
      recommendedPrompts: ['Create a quarterly report'],
      enabledSkills: ['officecli-docx'],
      mcpNames: ['excel-mcp'],
      permissionMode: 'default',
    });

    expect(profile?.id).toBe('word-creator');
    expect(profile?.source).toBe('bundled');
    expect(profile?.instructions.claude_md).toBe('You create Word documents.');
    expect(profile?.defaults.skills.enabled).toEqual(['officecli-docx']);
    expect(profile?.defaults.mcp.enabled).toEqual(['excel-mcp']);
  });

  it('maps assistant detail into profile seed input', () => {
    const detail: AssistantDetail = {
      id: 'excel-creator',
      source: 'builtin',
      profile: {
        name: 'Excel Creator',
        name_i18n: { 'zh-CN': 'Excel 表格助手' },
        description_i18n: {},
      },
      state: { enabled: true, sort_order: 1 },
      engine: { agent_backend: 'aionrs' },
      rules: { content: 'Excel rules', storage_mode: 'builtin' },
      prompts: {
        recommended: ['Build a tracker'],
        recommended_i18n: { 'zh-CN': ['创建销售跟踪表'] },
      },
      defaults: {
        model: { mode: 'inherit' },
        permission: { mode: 'inherit' },
        skills: { mode: 'fixed', value: ['officecli-xlsx'] },
        mcps: { mode: 'fixed', value: ['ccb-mcp:excel-mcp'] },
      },
      capabilities: {
        default_skill_ids: ['officecli-xlsx'],
        custom_skill_names: [],
        default_disabled_builtin_skill_ids: [],
      },
      preferences: {
        last_skill_ids: [],
        last_disabled_builtin_skill_ids: [],
        last_mcp_ids: [],
      },
    };

    const seed = assistantDetailToProfileSeed(detail, 'Excel Creator');
    expect(seed.name).toBe('Excel 表格助手');
    expect(seed.rulesContent).toBe('Excel rules');
    expect(seed.enabledSkills).toEqual(['officecli-xlsx']);
    expect(seed.mcpNames).toEqual(['excel-mcp']);
    expect(seed.recommendedPrompts).toEqual(['创建销售跟踪表']);
  });

  it('builds profile seed from assistant list row when detail API is unavailable', () => {
    const assistant: Assistant = {
      id: 'builtin-word-creator',
      source: 'builtin',
      name: 'Word Creator',
      name_i18n: { 'zh-CN': 'Word 文档助手' },
      description_i18n: {},
      enabled: true,
      sort_order: 1,
      preset_agent_type: 'aionrs',
      enabled_skills: ['officecli-docx'],
      custom_skill_names: [],
      disabled_builtin_skills: [],
      context_i18n: { 'zh-CN': 'Create Word docs.' },
      prompts: [],
      prompts_i18n: { 'zh-CN': ['Write a proposal'] },
      models: [],
    };

    const seed = assistantListRowToProfileSeed(assistant, '# Word rules');
    expect(seed.name).toBe('Word 文档助手');
    expect(seed.rulesContent).toBe('# Word rules');
    expect(seed.enabledSkills).toEqual(['officecli-docx']);
    expect(seed.recommendedPrompts).toEqual(['Write a proposal']);

    const profile = buildBundledCcbAssistantProfile(seed);
    expect(profile?.id).toBe('word-creator');
  });
});

describe('isCcbAssistantProfileSeedSuccessful', () => {
  it('treats created profiles as success', async () => {
    const { isCcbAssistantProfileSeedSuccessful } = await import('@/common/config/ccbAssistantProfileMigration');
    expect(
      isCcbAssistantProfileSeedSuccessful(
        {
          seeded_at: '',
          config_dir: '',
          profiles_created: ['word-creator'],
          profiles_skipped_existing: [],
          profiles_skipped_empty: [],
          profiles_failed: [],
        },
        21
      )
    ).toBe(true);
  });

  it('treats all-empty skip as incomplete seed', async () => {
    const { isCcbAssistantProfileSeedSuccessful } = await import('@/common/config/ccbAssistantProfileMigration');
    expect(
      isCcbAssistantProfileSeedSuccessful(
        {
          seeded_at: '',
          config_dir: '',
          profiles_created: [],
          profiles_skipped_existing: [],
          profiles_skipped_empty: ['word-creator'],
          profiles_failed: [],
        },
        21
      )
    ).toBe(false);
  });
});

describe('resolveCcbPresetAgentType', () => {
  it('routes preset assistants to claude when CCB authority is active', () => {
    expect(
      resolveCcbPresetAgentType('aionrs', {
        ccbAuthorityActive: true,
        isPresetAssistant: true,
      })
    ).toBe('claude');
  });

  it('preserves original backend when CCB authority is inactive', () => {
    expect(
      resolveCcbPresetAgentType('aionrs', {
        ccbAuthorityActive: false,
        isPresetAssistant: true,
      })
    ).toBe('aionrs');
  });
});
