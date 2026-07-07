/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Apply Guid/session permission mode to the live ACP session after warmup.
 * CCB-Wanding reads `_meta.permissionMode` at session/new; this covers
 * legacy rows and races where the UI seed has not yet reached the backend.
 */

import {
  acpAdapterGetMode,
  acpAdapterSetMode,
} from '@/common/adapter/acpConfigOptionsAdapter';

export type EnsureCcbSessionPreferredModeResult =
  | { status: 'not_applicable' }
  | { status: 'already_applied'; backend_mode: string }
  | { status: 'applied'; previous_backend_mode: string; confirmed_mode: string }
  | { status: 'failed'; error: string; previous_backend_mode?: string };

export async function ensureCcbSessionPreferredMode(params: {
  conversation_id: string;
  preferredMode: string;
}): Promise<EnsureCcbSessionPreferredModeResult> {
  const preferredMode = params.preferredMode.trim();
  if (!preferredMode) {
    return { status: 'not_applicable' };
  }

  try {
    const current = await acpAdapterGetMode(params.conversation_id);
    const backendMode = current?.mode?.trim() ?? '';
    if (backendMode === preferredMode) {
      return { status: 'already_applied', backend_mode: backendMode };
    }

    const confirmed = await acpAdapterSetMode(params.conversation_id, preferredMode);
    const confirmedMode = confirmed.mode?.trim() || preferredMode;
    return {
      status: 'applied',
      previous_backend_mode: backendMode,
      confirmed_mode: confirmedMode,
    };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function assertCcbSessionPreferredModeApplied(
  result: EnsureCcbSessionPreferredModeResult,
  preferredMode: string,
): void {
  const preferred = preferredMode.trim();
  if (!preferred) return;

  if (result.status === 'not_applicable') {
    throw new Error('Permission mode sync did not run.');
  }
  if (result.status === 'failed') {
    throw new Error(result.error || 'Failed to apply permission mode.');
  }
  if (result.status === 'already_applied') {
    if (result.backend_mode !== preferred) {
      throw new Error(
        `Permission mode mismatch: backend=${result.backend_mode}, expected=${preferred}`,
      );
    }
    return;
  }
  if (result.status === 'applied' && result.confirmed_mode !== preferred) {
    throw new Error(
      `Permission mode not confirmed: got ${result.confirmed_mode}, expected ${preferred}`,
    );
  }
}
