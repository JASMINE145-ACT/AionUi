/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for renderer/hooks/assistant/useAssistantList.ts (A1 in N4a).
 * Tests useAssistantList hook: load, sort, and active selection behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { fetchAssistantsCatalogMock } = vi.hoisted(() => ({
  fetchAssistantsCatalogMock: vi.fn(),
}));

vi.mock('@/common/assistants/fetchAssistantsCatalog', () => ({
  ASSISTANTS_LIST_SWR_KEY: 'assistants-list',
  fetchAssistantsCatalog: fetchAssistantsCatalogMock,
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    assistants: {
      setState: { invoke: vi.fn(), provider: vi.fn() },
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('swr', () => ({
  mutate: vi.fn(),
}));

import { useAssistantList } from '@/renderer/hooks/assistant/useAssistantList';
import { ipcBridge } from '@/common';
import type { Assistant } from '@/common/types/agent/assistantTypes';

describe('useAssistantList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads assistants on mount and selects first by default', async () => {
    const mockList: Assistant[] = [
      { id: '1', name: 'Claude', sort_order: 1, source: 'builtin', enabled: true },
      { id: '2', name: 'GPT', sort_order: 2, source: 'user', enabled: true },
    ];
    fetchAssistantsCatalogMock.mockResolvedValue(mockList);

    const { result } = renderHook(() => useAssistantList());

    await waitFor(() => expect(result.current.assistants).toHaveLength(2));

    expect(result.current.assistants[0].id).toBe('1');
    expect(result.current.activeAssistantId).toBe('1');
    expect(result.current.activeAssistant?.id).toBe('1');
  });

  it('preserves backend order instead of resorting client side', async () => {
    const mockList: Assistant[] = [
      { id: 'cowork', name: 'Cowork', sort_order: 2000, source: 'builtin', enabled: true },
      { id: 'writer', name: 'Writer', sort_order: 1000, source: 'user', enabled: true },
    ];
    fetchAssistantsCatalogMock.mockResolvedValue(mockList);

    const { result } = renderHook(() => useAssistantList());

    await waitFor(() => expect(result.current.assistants).toHaveLength(2));

    expect(result.current.assistants.map((assistant) => assistant.id)).toEqual(['cowork', 'writer']);
  });

  it('handles empty list', async () => {
    fetchAssistantsCatalogMock.mockResolvedValue([]);

    const { result } = renderHook(() => useAssistantList());

    await waitFor(() => expect(fetchAssistantsCatalogMock).toHaveBeenCalled());

    expect(result.current.assistants).toHaveLength(0);
    expect(result.current.activeAssistantId).toBeNull();
    expect(result.current.activeAssistant).toBeNull();
  });

  it('preserves active selection if still present after reload', async () => {
    const mockList: Assistant[] = [
      { id: '1', name: 'Claude', sort_order: 1, source: 'builtin', enabled: true },
      { id: '2', name: 'GPT', sort_order: 2, source: 'user', enabled: true },
    ];
    fetchAssistantsCatalogMock.mockResolvedValue(mockList);

    const { result } = renderHook(() => useAssistantList());

    await waitFor(() => expect(result.current.assistants).toHaveLength(2));

    act(() => {
      result.current.setActiveAssistantId('2');
    });

    await act(async () => {
      await result.current.loadAssistants();
    });

    expect(result.current.activeAssistantId).toBe('2');
    expect(result.current.activeAssistant?.id).toBe('2');
  });

  it('falls back to first assistant if previous active is removed', async () => {
    fetchAssistantsCatalogMock
      .mockResolvedValueOnce([
        { id: '1', name: 'Claude', sort_order: 1, source: 'builtin', enabled: true },
        { id: '2', name: 'GPT', sort_order: 2, source: 'user', enabled: true },
      ])
      .mockResolvedValueOnce([{ id: '1', name: 'Claude', sort_order: 1, source: 'builtin', enabled: true }]);

    const { result } = renderHook(() => useAssistantList());

    await waitFor(() => expect(result.current.assistants).toHaveLength(2));

    act(() => {
      result.current.setActiveAssistantId('2');
    });

    await act(async () => {
      await result.current.loadAssistants();
    });

    expect(result.current.activeAssistantId).toBe('1');
  });

  it('logs error and does not crash on load failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchAssistantsCatalogMock.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useAssistantList());

    await waitFor(() => expect(errorSpy).toHaveBeenCalled());

    expect(result.current.assistants).toHaveLength(0);
    errorSpy.mockRestore();
  });

  it('reorders assistants and persists sort_order updates', async () => {
    const mockList: Assistant[] = [
      { id: '1', name: 'Claude', sort_order: 1, source: 'builtin', enabled: true },
      { id: '2', name: 'GPT', sort_order: 2, source: 'user', enabled: true },
    ];
    fetchAssistantsCatalogMock.mockResolvedValue(mockList);
    (ipcBridge.assistants.setState.invoke as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAssistantList());

    await waitFor(() => expect(result.current.assistants).toHaveLength(2));

    await act(async () => {
      await result.current.reorderAssistants('1', '2');
    });

    expect(result.current.assistants.map((a) => a.id)).toEqual(['2', '1']);
    expect(ipcBridge.assistants.setState.invoke).toHaveBeenCalled();
  });

  it('restores the previous order when reorder persistence fails', async () => {
    const mockList: Assistant[] = [
      { id: '1', name: 'Claude', sort_order: 1, source: 'builtin', enabled: true },
      { id: '2', name: 'GPT', sort_order: 2, source: 'user', enabled: true },
    ];
    fetchAssistantsCatalogMock.mockResolvedValue(mockList);
    (ipcBridge.assistants.setState.invoke as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('persist failed'));

    const { result } = renderHook(() => useAssistantList());

    await waitFor(() => expect(result.current.assistants).toHaveLength(2));

    await act(async () => {
      await result.current.reorderAssistants('1', '2');
    });

    expect(result.current.assistants.map((a) => a.id)).toEqual(['1', '2']);
  });
});
