import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchSettingsSkillsCatalog } from '@/common/skills/fetchSkillsCatalog';

const {
  ccbAuthorityMock,
  listAvailableSkillsMock,
  getSkillPathsMock,
  listBuiltinAutoSkillsMock,
  syncFromAionUiMock,
  listCcbSkillsMock,
  getCcbPathsMock,
} = vi.hoisted(() => ({
  ccbAuthorityMock: vi.fn(),
  listAvailableSkillsMock: vi.fn(),
  getSkillPathsMock: vi.fn(),
  listBuiltinAutoSkillsMock: vi.fn(),
  syncFromAionUiMock: vi.fn(),
  listCcbSkillsMock: vi.fn(),
  getCcbPathsMock: vi.fn(),
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  fs: {
    listAvailableSkills: { invoke: listAvailableSkillsMock },
    getSkillPaths: { invoke: getSkillPathsMock },
    listBuiltinAutoSkills: { invoke: listBuiltinAutoSkillsMock },
  },
  ccbModelService: {
    isAuthorityActive: { invoke: ccbAuthorityMock },
  },
  ccbSkillsService: {
    syncFromAionUi: { invoke: syncFromAionUiMock },
    listSkills: { invoke: listCcbSkillsMock },
    getPaths: { invoke: getCcbPathsMock },
  },
}));

describe('fetchSettingsSkillsCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncFromAionUiMock.mockResolvedValue(undefined);
  });

  it('loads upstream skills when CCB authority is inactive', async () => {
    ccbAuthorityMock.mockResolvedValue(false);
    listAvailableSkillsMock.mockResolvedValue([
      { name: 'cron', description: 'Cron skill', location: '/a/skills/cron', is_custom: false, source: 'builtin' },
    ]);
    getSkillPathsMock.mockResolvedValue({ user_skills_dir: '/a/skills', builtin_skills_dir: '/a/builtin' });
    listBuiltinAutoSkillsMock.mockResolvedValue([{ name: 'auto-skill', description: 'Auto' }]);

    const catalog = await fetchSettingsSkillsCatalog();

    expect(catalog.source).toBe('aionui');
    expect(catalog.skills).toHaveLength(1);
    expect(catalog.builtinAutoSkills).toHaveLength(1);
    expect(listAvailableSkillsMock).toHaveBeenCalledOnce();
    expect(listCcbSkillsMock).not.toHaveBeenCalled();
  });

  it('loads CCB skills when CCB authority is active', async () => {
    ccbAuthorityMock.mockResolvedValue(true);
    listCcbSkillsMock.mockResolvedValue([
      {
        name: 'ccb-subagent-gate',
        description: 'Gate skill',
        location: 'C:\\CCB\\.claude\\skills\\ccb-subagent-gate',
        is_custom: false,
        source: 'ccb-wanding',
        status: 'ready',
      },
      {
        name: 'broken-skill',
        description: 'Missing',
        location: '',
        is_custom: false,
        source: 'ccb-wanding',
        status: 'missing',
      },
    ]);
    getCcbPathsMock.mockResolvedValue({
      user_skills_dir: 'C:\\CCB\\.claude\\skills',
      builtin_skills_dir: 'C:\\CCB\\.claude\\skills',
    });

    const catalog = await fetchSettingsSkillsCatalog();

    expect(catalog.source).toBe('ccb');
    expect(catalog.skills.map((skill) => skill.name)).toEqual(['ccb-subagent-gate']);
    expect(catalog.skills[0]?.source).toBe('ccb-wanding');
    expect(catalog.builtinAutoSkills).toEqual([]);
    expect(syncFromAionUiMock).toHaveBeenCalledOnce();
    expect(listCcbSkillsMock).toHaveBeenCalledOnce();
    expect(listAvailableSkillsMock).not.toHaveBeenCalled();
  });
});
