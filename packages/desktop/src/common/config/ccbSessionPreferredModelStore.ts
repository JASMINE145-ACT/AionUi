/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * In-memory session preferred MiniMax variant per conversation.
 * Updated synchronously on UI switch so send/warmup paths see the latest
 * choice before conversation.extra is reloaded from the main process.
 */

import { conversation as conversationBridge } from '@/common/adapter/ipcBridge'
import { normalizeCcbMiniMaxModelId } from './ccbAcpModelInfo'

const preferredModelByConversation = new Map<string, string>()

export function seedCcbSessionPreferredModelId(
  conversationId: string,
  modelId: string | null | undefined
): void {
  const normalized = normalizeCcbMiniMaxModelId(modelId)
  if (!normalized) return
  if (!preferredModelByConversation.has(conversationId)) {
    preferredModelByConversation.set(conversationId, normalized)
  }
}

export function setCcbSessionPreferredModelId(conversationId: string, modelId: string): void {
  const normalized = normalizeCcbMiniMaxModelId(modelId) ?? modelId
  preferredModelByConversation.set(conversationId, normalized)
}

export function getCcbSessionPreferredModelId(
  conversationId: string,
  fallback?: string
): string | undefined {
  return preferredModelByConversation.get(conversationId) ?? fallback
}

export function clearCcbSessionPreferredModelId(conversationId: string): void {
  preferredModelByConversation.delete(conversationId)
}

/** Persist session model choice to conversation.extra for reload/resume. */
export async function persistCcbSessionPreferredModelId(
  conversationId: string,
  modelId: string
): Promise<boolean> {
  const normalized = normalizeCcbMiniMaxModelId(modelId) ?? modelId
  setCcbSessionPreferredModelId(conversationId, normalized)
  try {
    return await conversationBridge.update.invoke({
      id: conversationId,
      merge_extra: true,
      updates: {
        extra: {
          ccb_preferred_model_id: normalized,
        },
      },
    })
  } catch (error) {
    console.error('[persistCcbSessionPreferredModelId] failed:', error)
    return false
  }
}
