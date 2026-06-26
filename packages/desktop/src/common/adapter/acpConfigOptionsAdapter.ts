/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dual-path adapter for ACP model/mode: config-options (aioncore 0.1.29+) with
 * legacy /model|/mode fallback (bundled 0.1.27). Silences double-404 on reads.
 */

import { httpRequest, isBackendHttpError } from '@/common/adapter/httpBridge';
import type { AcpModelInfo } from '@/common/types/platform/acpTypes';
import type {
  AcpConfigOptionDto,
  GetConfigOptionsResponse,
  SetConfigOptionResponse,
} from '@/common/types/platform/acpConfigOptionsTypes';

const SILENT_READ_STATUSES = [404];

/** null = undetected; true = config-options route available; false = use legacy only. */
let configOptionsAvailable: boolean | null = null;

export function resetConfigOptionsDetection(): void {
  configOptionsAvailable = null;
}

export function findConfigOption(options: AcpConfigOptionDto[], id: string): AcpConfigOptionDto | undefined {
  return options.find((o) => o.id === id);
}

export function configOptionToModelInfo(option: AcpConfigOptionDto): AcpModelInfo | null {
  const currentModelId = option.current_value ?? null;
  if (!currentModelId && option.options.length === 0) {
    return null;
  }

  const availableModels = option.options.map((o) => ({
    id: o.value,
    label: o.label ?? o.name ?? o.value,
  }));

  const matched = option.options.find((o) => o.value === currentModelId);
  const currentModelLabel = matched ? (matched.label ?? matched.name ?? matched.value) : currentModelId;

  return {
    current_model_id: currentModelId,
    current_model_label: currentModelLabel,
    available_models: availableModels,
  };
}

export function configOptionToModeResult(
  option: AcpConfigOptionDto | undefined
): { mode: string; initialized: boolean } {
  if (!option) {
    return { mode: 'default', initialized: false };
  }
  return {
    mode: option.current_value ?? 'default',
    initialized: true,
  };
}

function modeResultFromOptions(options: AcpConfigOptionDto[]): { mode: string; initialized: boolean } {
  return configOptionToModeResult(findConfigOption(options, 'mode'));
}

function modelResultFromOptions(options: AcpConfigOptionDto[]): { model_info: AcpModelInfo | null } {
  const modelOption = findConfigOption(options, 'model');
  return { model_info: modelOption ? configOptionToModelInfo(modelOption) : null };
}

/** Route-level 404 — config-options endpoint does not exist (bundled aioncore). */
export function isConfigOptionsRouteMissing(error: unknown): boolean {
  if (!isBackendHttpError(error) || error.status !== 404) {
    return false;
  }
  const message = `${error.backendMessage} ${error.message}`.toLowerCase();
  return message.includes('route not found');
}

function markConfigOptionsUnavailable(error: unknown): void {
  if (isConfigOptionsRouteMissing(error)) {
    configOptionsAvailable = false;
  }
}

function configOptionsPath(conversationId: string): string {
  return `/api/conversations/${conversationId}/config-options`;
}

function legacyModelPath(conversationId: string): string {
  return `/api/conversations/${conversationId}/model`;
}

function legacyModePath(conversationId: string): string {
  return `/api/conversations/${conversationId}/mode`;
}

async function fetchConfigOptions(conversationId: string): Promise<AcpConfigOptionDto[]> {
  const response = await httpRequest<GetConfigOptionsResponse>(
    'GET',
    configOptionsPath(conversationId),
    undefined,
    { silentStatuses: SILENT_READ_STATUSES }
  );
  configOptionsAvailable = true;
  return response.config_options ?? [];
}

async function tryFetchConfigOptions(conversationId: string): Promise<AcpConfigOptionDto[] | null> {
  if (configOptionsAvailable === false) {
    return null;
  }

  try {
    return await fetchConfigOptions(conversationId);
  } catch (error) {
    if (!isBackendHttpError(error) || error.status !== 404) {
      throw error;
    }
    markConfigOptionsUnavailable(error);
    return null;
  }
}

async function legacyGetModel(conversationId: string): Promise<{ model_info: AcpModelInfo | null }> {
  try {
    return await httpRequest<{ model_info: AcpModelInfo | null }>(
      'GET',
      legacyModelPath(conversationId),
      undefined,
      { silentStatuses: SILENT_READ_STATUSES }
    );
  } catch (error) {
    if (isBackendHttpError(error) && error.status === 404) {
      return { model_info: null };
    }
    throw error;
  }
}

async function legacyGetMode(conversationId: string): Promise<{ mode: string; initialized: boolean }> {
  try {
    return await httpRequest<{ mode: string; initialized: boolean }>(
      'GET',
      legacyModePath(conversationId),
      undefined,
      { silentStatuses: SILENT_READ_STATUSES }
    );
  } catch (error) {
    if (isBackendHttpError(error) && error.status === 404) {
      return { mode: 'default', initialized: false };
    }
    throw error;
  }
}

export async function acpAdapterGetModel(conversationId: string): Promise<{ model_info: AcpModelInfo | null }> {
  const options = await tryFetchConfigOptions(conversationId);
  if (options !== null) {
    return modelResultFromOptions(options);
  }
  return legacyGetModel(conversationId);
}

export async function acpAdapterGetMode(conversationId: string): Promise<{ mode: string; initialized: boolean }> {
  const options = await tryFetchConfigOptions(conversationId);
  if (options !== null) {
    return modeResultFromOptions(options);
  }
  return legacyGetMode(conversationId);
}

async function putConfigOption(
  conversationId: string,
  optionId: string,
  value: string
): Promise<SetConfigOptionResponse> {
  return httpRequest<SetConfigOptionResponse>('PUT', `${configOptionsPath(conversationId)}/${optionId}`, {
    value,
  });
}

async function resolveOptionsAfterSet(
  conversationId: string,
  response: SetConfigOptionResponse
): Promise<AcpConfigOptionDto[]> {
  if (response.config_options) {
    return response.config_options;
  }
  return fetchConfigOptions(conversationId);
}

export async function acpAdapterSetModel(
  conversationId: string,
  modelId: string
): Promise<{ model_info: AcpModelInfo | null }> {
  if (configOptionsAvailable !== false) {
    try {
      const response = await putConfigOption(conversationId, 'model', modelId);
      configOptionsAvailable = true;
      const options = await resolveOptionsAfterSet(conversationId, response);
      return modelResultFromOptions(options);
    } catch (error) {
      if (!isBackendHttpError(error) || error.status !== 404) {
        throw error;
      }
      markConfigOptionsUnavailable(error);
    }
  }

  return httpRequest<{ model_info: AcpModelInfo | null }>('PUT', legacyModelPath(conversationId), {
    model_id: modelId,
  });
}

export async function acpAdapterSetMode(
  conversationId: string,
  mode: string
): Promise<{ mode: string; initialized: boolean }> {
  if (configOptionsAvailable !== false) {
    try {
      const response = await putConfigOption(conversationId, 'mode', mode);
      configOptionsAvailable = true;
      const options = await resolveOptionsAfterSet(conversationId, response);
      return modeResultFromOptions(options);
    } catch (error) {
      if (!isBackendHttpError(error) || error.status !== 404) {
        throw error;
      }
      markConfigOptionsUnavailable(error);
    }
  }

  return httpRequest<{ mode: string; initialized: boolean }>('PUT', legacyModePath(conversationId), { mode });
}
