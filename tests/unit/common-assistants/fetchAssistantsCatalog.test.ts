import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ASSISTANTS_LIST_SWR_KEY, fetchAssistantsCatalog } from '@/common/assistants/fetchAssistantsCatalog';

const { assistantsListMock, ccbAgentsListMock, ccbAuthorityMock } = vi.hoisted(() => ({
  assistantsListMock: vi.fn(),
  ccbAgentsListMock: vi.fn(),
  ccbAuthorityMock: vi.fn(),
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  assistants: {
    list: { invoke: assistantsListMock },
  },
  ccbAgentsService: {
    listAgents: { invoke: ccbAgentsListMock },
  },
  ccbModelService: {
    isAuthorityActive: { invoke: ccbAuthorityMock },
  },
}));

describe('fetchAssistantsCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports the shared SWR key used by Guid and Settings', () => {
    expect(ASSISTANTS_LIST_SWR_KEY).toBe('assistants.list');
  });

  it('loads backend assistants when CCB authority is inactive', async () => {
    ccbAuthorityMock.mockResolvedValue(false);
    assistantsListMock.mockResolvedValue([{ id: 'word-creator', name: 'Word', source: 'builtin' }]);

    const list = await fetchAssistantsCatalog();

    expect(list).toHaveLength(1);
    expect(assistantsListMock).toHaveBeenCalledOnce();
    expect(ccbAgentsListMock).not.toHaveBeenCalled();
  });

  it('loads CCB agent catalog when CCB authority is active', async () => {
    ccbAuthorityMock.mockResolvedValue(true);
    ccbAgentsListMock.mockResolvedValue([
      {
        id: 'wande-orchestrator',
        name: 'wande-orchestrator',
        display_name: '万鼎协作',
        source: 'bundled',
        enabled: true,
        schema_version: 1,
        skills: { enabled: [], disabled: [] },
        mcp_allowlist: [],
        recommended_prompts: [],
      },
      {
        id: 'quotation-agent',
        name: 'quotation-agent',
        display_name: '万鼎报价专家',
        source: 'bundled',
        enabled: true,
        guid_primary: true,
        schema_version: 1,
        skills: { enabled: [], disabled: [] },
        mcp_allowlist: [],
        recommended_prompts: [],
      },
    ]);

    const list = await fetchAssistantsCatalog();

    expect(list.map((item) => item.id)).toEqual(['quotation-agent']);
    expect(ccbAgentsListMock).toHaveBeenCalledOnce();
    expect(assistantsListMock).not.toHaveBeenCalled();
  });
});
