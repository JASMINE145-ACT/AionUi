/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackendHttpError } from '@/common/adapter/httpBridge';
import {
  acpAdapterGetMode,
  acpAdapterGetModel,
  acpAdapterSetMode,
  acpAdapterSetModel,
  configOptionToModeResult,
  configOptionToModelInfo,
  isConfigOptionsRouteMissing,
  resetConfigOptionsDetection,
} from '@/common/adapter/acpConfigOptionsAdapter';
import type { AcpConfigOptionDto } from '@/common/types/platform/acpConfigOptionsTypes';

vi.mock('@/common/adapter/httpBridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/common/adapter/httpBridge')>();
  return {
    ...actual,
    httpRequest: vi.fn(),
  };
});

const httpRequest = vi.mocked((await import('@/common/adapter/httpBridge')).httpRequest);

function routeNotFoundError(path: string): BackendHttpError {
  return new BackendHttpError({
    method: 'GET',
    path,
    status: 404,
    body: { code: 'NOT_FOUND', error: 'Route not found.' },
  });
}

function noAgentError(path: string): BackendHttpError {
  return new BackendHttpError({
    method: 'GET',
    path,
    status: 404,
    body: { code: 'NOT_FOUND', error: 'No active agent for this conversation' },
  });
}

const modelOption: AcpConfigOptionDto = {
  id: 'model',
  type: 'select',
  current_value: 'gpt-5',
  options: [
    { value: 'gpt-5', label: 'GPT-5' },
    { value: 'gpt-4', name: 'GPT-4' },
    { value: 'raw-id' },
  ],
};

const modeOption: AcpConfigOptionDto = {
  id: 'mode',
  type: 'select',
  current_value: 'plan',
  options: [{ value: 'plan', label: 'Plan' }],
};

describe('acpConfigOptionsAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetConfigOptionsDetection();
  });

  describe('configOptionToModelInfo', () => {
    it('maps current model and available models with label fallbacks', () => {
      expect(configOptionToModelInfo(modelOption)).toEqual({
        current_model_id: 'gpt-5',
        current_model_label: 'GPT-5',
        available_models: [
          { id: 'gpt-5', label: 'GPT-5' },
          { id: 'gpt-4', label: 'GPT-4' },
          { id: 'raw-id', label: 'raw-id' },
        ],
      });
    });

    it('uses current_value as label when option list is empty', () => {
      expect(
        configOptionToModelInfo({
          id: 'model',
          type: 'select',
          current_value: 'solo',
          options: [],
        })
      ).toEqual({
        current_model_id: 'solo',
        current_model_label: 'solo',
        available_models: [],
      });
    });

    it('returns null when no current value and no options', () => {
      expect(
        configOptionToModelInfo({
          id: 'model',
          type: 'select',
          options: [],
        })
      ).toBeNull();
    });
  });

  describe('configOptionToModeResult', () => {
    it('maps mode option to initialized result', () => {
      expect(configOptionToModeResult(modeOption)).toEqual({ mode: 'plan', initialized: true });
    });

    it('returns default uninitialized when mode option is missing', () => {
      expect(configOptionToModeResult(undefined)).toEqual({ mode: 'default', initialized: false });
    });
  });

  describe('isConfigOptionsRouteMissing', () => {
    it('detects route-not-found 404 only', () => {
      expect(isConfigOptionsRouteMissing(routeNotFoundError('/api/conversations/c1/config-options'))).toBe(true);
      expect(isConfigOptionsRouteMissing(noAgentError('/api/conversations/c1/config-options'))).toBe(false);
    });
  });

  describe('acpAdapterGetModel', () => {
    it('reads model from config-options when available', async () => {
      httpRequest.mockResolvedValueOnce({ config_options: [modelOption, modeOption] });

      const result = await acpAdapterGetModel('c1');

      expect(result.model_info?.current_model_id).toBe('gpt-5');
      expect(httpRequest).toHaveBeenCalledWith(
        'GET',
        '/api/conversations/c1/config-options',
        undefined,
        expect.objectContaining({ silentStatuses: [404] })
      );
    });

    it('falls back to legacy /model when config-options route is missing', async () => {
      httpRequest
        .mockRejectedValueOnce(routeNotFoundError('/api/conversations/c1/config-options'))
        .mockResolvedValueOnce({
          model_info: { current_model_id: 'legacy', current_model_label: 'Legacy', available_models: [] },
        });

      const result = await acpAdapterGetModel('c1');

      expect(result.model_info?.current_model_id).toBe('legacy');
      expect(httpRequest).toHaveBeenNthCalledWith(2, 'GET', '/api/conversations/c1/model', undefined, expect.any(Object));
    });

    it('silences double 404 and returns null model_info', async () => {
      httpRequest
        .mockRejectedValueOnce(noAgentError('/api/conversations/c1/config-options'))
        .mockRejectedValueOnce(routeNotFoundError('/api/conversations/c1/model'));

      await expect(acpAdapterGetModel('c1')).resolves.toEqual({ model_info: null });
    });

    it('skips config-options after route-missing detection is cached', async () => {
      httpRequest
        .mockRejectedValueOnce(routeNotFoundError('/api/conversations/c1/config-options'))
        .mockResolvedValueOnce({ model_info: null });

      await acpAdapterGetModel('c1');
      vi.clearAllMocks();
      httpRequest.mockResolvedValueOnce({ model_info: null });

      await acpAdapterGetModel('c1');

      expect(httpRequest).toHaveBeenCalledTimes(1);
      expect(httpRequest).toHaveBeenCalledWith('GET', '/api/conversations/c1/model', undefined, expect.any(Object));
    });
  });

  describe('acpAdapterGetMode', () => {
    it('returns uninitialized when mode option is absent from config-options', async () => {
      httpRequest.mockResolvedValueOnce({ config_options: [modelOption] });

      await expect(acpAdapterGetMode('c1')).resolves.toEqual({ mode: 'default', initialized: false });
    });

    it('silences legacy 404 after config-options agent-not-found', async () => {
      httpRequest
        .mockRejectedValueOnce(noAgentError('/api/conversations/c1/config-options'))
        .mockRejectedValueOnce(routeNotFoundError('/api/conversations/c1/mode'));

      await expect(acpAdapterGetMode('c1')).resolves.toEqual({ mode: 'default', initialized: false });
    });
  });

  describe('acpAdapterSetModel', () => {
    it('writes via config-options and maps response snapshot', async () => {
      const updated = { ...modelOption, current_value: 'gpt-4' };
      httpRequest.mockResolvedValueOnce({
        confirmation: 'observed',
        config_options: [updated, modeOption],
      });

      const result = await acpAdapterSetModel('c1', 'gpt-4');

      expect(result.model_info?.current_model_id).toBe('gpt-4');
      expect(httpRequest).toHaveBeenCalledWith('PUT', '/api/conversations/c1/config-options/model', { value: 'gpt-4' });
    });

    it('re-fetches config-options when set response has no snapshot', async () => {
      httpRequest
        .mockResolvedValueOnce({ confirmation: 'command_ack', config_options: undefined })
        .mockResolvedValueOnce({ config_options: [modelOption] });

      await acpAdapterSetModel('c1', 'gpt-5');

      expect(httpRequest).toHaveBeenNthCalledWith(2, 'GET', '/api/conversations/c1/config-options', undefined, expect.any(Object));
    });

    it('falls back to legacy PUT /model when config-options route is missing', async () => {
      httpRequest
        .mockRejectedValueOnce(routeNotFoundError('/api/conversations/c1/config-options/model'))
        .mockResolvedValueOnce({ model_info: null });

      await acpAdapterSetModel('c1', 'gpt-5');

      expect(httpRequest).toHaveBeenNthCalledWith(
        2,
        'PUT',
        '/api/conversations/c1/model',
        { model_id: 'gpt-5' }
      );
    });
  });

  describe('acpAdapterSetMode', () => {
    it('writes via config-options and returns initialized mode', async () => {
      httpRequest.mockResolvedValueOnce({
        confirmation: 'observed',
        config_options: [modelOption, { ...modeOption, current_value: 'act' }],
      });

      await expect(acpAdapterSetMode('c1', 'act')).resolves.toEqual({ mode: 'act', initialized: true });
    });
  });
});
