/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Apply Guid/session permission mode to the live ACP session after warmup.
 * CCB-Wanding reads `_meta.permissionMode` at session/new; this covers
 * legacy rows and races where the UI seed has not yet reached the backend.
 */

import { acpConversation } from '@/common/adapter/ipcBridge';

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
    const current = await acpConversation.getMode.invoke({ conversation_id: params.conversation_id });
    const backendMode = current?.mode?.trim() ?? '';
    if (backendMode === preferredMode) {
      return { status: 'already_applied', backend_mode: backendMode };
    }

    const confirmed = await acpConversation.setMode.invoke({
      conversation_id: params.conversation_id,
      mode: preferredMode,
    });
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
