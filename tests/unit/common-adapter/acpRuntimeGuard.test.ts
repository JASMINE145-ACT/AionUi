import { describe, expect, it, vi } from 'vitest';

import {
  invokeWithAcpWarmupRetry,
  shouldWarmupBeforeAcpMutationRetry,
} from '@/common/adapter/acpRuntimeGuard';
import { BackendHttpError } from '@/common/adapter/httpBridge';

describe('acpRuntimeGuard', () => {
  it('shouldWarmupBeforeAcpMutationRetry matches NOT_FOUND and no active agent', () => {
    expect(
      shouldWarmupBeforeAcpMutationRetry(
        new BackendHttpError({
          method: 'PUT',
          path: '/api/conversations/x/model',
          status: 404,
          body: { code: 'NOT_FOUND', error: 'No active agent for this conversation' },
        })
      )
    ).toBe(true);
    expect(shouldWarmupBeforeAcpMutationRetry(new Error('other'))).toBe(false);
  });

  it('invokeWithAcpWarmupRetry warms up once then retries', async () => {
    const invoke = vi
      .fn()
      .mockRejectedValueOnce(
        new BackendHttpError({
          method: 'PUT',
          path: '/api/conversations/c1/model',
          status: 404,
          body: { code: 'NOT_FOUND', error: 'No active agent for this conversation' },
        })
      )
      .mockResolvedValueOnce({ model_info: null });
    const warmup = vi.fn().mockResolvedValue(undefined);

    const result = await invokeWithAcpWarmupRetry(
      { conversation_id: 'c1', model_id: 'minimax-m3-thinking' },
      invoke,
      warmup
    );

    expect(result).toEqual({ model_info: null });
    expect(warmup).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
