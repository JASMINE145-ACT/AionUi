/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Defensive retries when aioncore evicts idle agents but conversation state
 * still references a dead runtime (404 / no active agent).
 */

import { isBackendHttpError } from '@/common/adapter/httpBridge';

export function shouldWarmupBeforeAcpMutationRetry(error: unknown): boolean {
  if (!isBackendHttpError(error) || error.status !== 404) {
    return false;
  }
  if (error.code === 'NOT_FOUND') {
    return true;
  }
  const message = `${error.backendMessage} ${error.message}`.toLowerCase();
  return message.includes('no active agent') || message.includes('active agent not found');
}

export async function invokeWithAcpWarmupRetry<T extends { conversation_id: string }, R>(
  params: T,
  invoke: (params: T) => Promise<R>,
  warmup: (params: T) => Promise<void>
): Promise<R> {
  try {
    return await invoke(params);
  } catch (error) {
    if (!shouldWarmupBeforeAcpMutationRetry(error)) {
      throw error;
    }
    await warmup(params);
    return await invoke(params);
  }
}
