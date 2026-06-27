/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getProfileInvokeMock = vi.fn();
const getAgentInvokeMock = vi.fn();
const assistantsGetMock = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    ccbAssistantProfilesService: {
      getProfile: { invoke: (...args: unknown[]) => getProfileInvokeMock(...args) },
    },
    assistants: {
      get: { invoke: (...args: unknown[]) => assistantsGetMock(...args) },
    },
  },
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  ccbAgentsService: {
    getAgent: { invoke: (...args: unknown[]) => getAgentInvokeMock(...args) },
  },
}));

import { fetchGuidAssistantDetail } from '@/renderer/pages/guid/utils/fetchGuidAssistantDetail';

describe('fetchGuidAssistantDetail', () => {
  beforeEach(() => {
    getProfileInvokeMock.mockReset();
    getAgentInvokeMock.mockReset();
    assistantsGetMock.mockReset();
  });

  it('uses CCB assistant profile when authority is active', async () => {
    getProfileInvokeMock.mockResolvedValue({
      schema_version: 1,
      id: 'quotation-agent',
      name: '万鼎报价专家',
      enabled: true,
      source: 'bundled',
      instructions: {},
      recommended_prompts: [],
      defaults: {
        model: null,
        permission_mode: null,
        skills: { enabled: [], disabled: [] },
        mcp: { enabled: ['quotation', 'excel'], disabled: [] },
      },
    });

    const detail = await fetchGuidAssistantDetail('quotation-agent', {
      localeKey: 'zh-CN',
      ccbAuthorityActive: true,
    });

    expect(getProfileInvokeMock).toHaveBeenCalledWith({ id: 'quotation-agent' });
    expect(assistantsGetMock).not.toHaveBeenCalled();
    expect(detail?.defaults.mcps.value).toEqual(['ccb-mcp:quotation', 'ccb-mcp:excel']);
  });

  it('falls back to aioncore assistants.get when CCB authority is off', async () => {
    assistantsGetMock.mockResolvedValue({ id: 'legacy-assistant' });

    const detail = await fetchGuidAssistantDetail('legacy-assistant', {
      localeKey: 'zh-CN',
      ccbAuthorityActive: false,
    });

    expect(assistantsGetMock).toHaveBeenCalledWith({ id: 'legacy-assistant', locale: 'zh-CN' });
    expect(getProfileInvokeMock).not.toHaveBeenCalled();
    expect(detail).toEqual({ id: 'legacy-assistant' });
  });
});
