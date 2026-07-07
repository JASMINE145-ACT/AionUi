/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Apply Guid/session preferred MiniMax variant to the live ACP session.
 * Must compare raw backend model ids — never UI-preserved display ids.
 */

import {
  acpAdapterGetModel,
  acpAdapterSetModel,
} from '@/common/adapter/acpConfigOptionsAdapter'
import type { AcpModelInfo } from '@/common/types/platform/acpTypes'
import type { CcbModelInfo } from './ccbModelSettingsShared'
import {
  ccbHasSwitchableModelVariants,
  normalizeCcbMiniMaxModelId,
  resolveBackendSessionModelId,
} from './ccbAcpModelInfo'

export type EnsureCcbSessionPreferredModelResult =
  | { status: 'not_applicable' }
  | { status: 'already_applied'; backend_model_id: string }
  | { status: 'applied'; previous_backend_model_id: string; confirmed_model_id: string }
  | { status: 'deferred'; reason: string; session_model_info: AcpModelInfo | null }
  | { status: 'failed'; error: string; previous_backend_model_id?: string }

export async function ensureCcbSessionPreferredModel(params: {
  conversation_id: string
  preferredModelId: string
  ccbModelInfo: CcbModelInfo | null | undefined
}): Promise<EnsureCcbSessionPreferredModelResult> {
  const preferredModelId =
    normalizeCcbMiniMaxModelId(params.preferredModelId) ?? params.preferredModelId

  if (!ccbHasSwitchableModelVariants(params.ccbModelInfo)) {
    return { status: 'not_applicable' }
  }

  const variantIds = new Set(
    (params.ccbModelInfo?.available_variants ?? []).map((variant) => variant.model_id)
  )
  if (!variantIds.has(preferredModelId)) {
    return { status: 'not_applicable' }
  }

  const { model_info: sessionInfo } = await acpAdapterGetModel(params.conversation_id)

  const backendModelId = resolveBackendSessionModelId(sessionInfo)
  const sessionHasVariantOption = Boolean(
    sessionInfo?.available_models?.some((model) => model.id === preferredModelId)
  )

  if (backendModelId === preferredModelId) {
    return { status: 'already_applied', backend_model_id: backendModelId }
  }

  // Session handshake may still list effort tiers before CCB variant ids appear.
  // CCB accepts variant ids via setModel — do not defer when the catalog has the id.
  if (!sessionHasVariantOption) {
    try {
      const confirmed = await acpAdapterSetModel(params.conversation_id, preferredModelId)
      const confirmedId =
        resolveBackendSessionModelId(confirmed.model_info ?? null) ?? preferredModelId
      return {
        status: 'applied',
        previous_backend_model_id: backendModelId ?? '',
        confirmed_model_id: confirmedId,
      }
    } catch (error) {
      return {
        status: 'deferred',
        reason: 'preferred_variant_not_in_session_options',
        session_model_info: sessionInfo ?? null,
      }
    }
  }

  try {
    const confirmed = await acpAdapterSetModel(params.conversation_id, preferredModelId)
    const confirmedId =
      resolveBackendSessionModelId(confirmed.model_info ?? null) ?? preferredModelId
    return {
      status: 'applied',
      previous_backend_model_id: backendModelId ?? '',
      confirmed_model_id: confirmedId,
    }
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      previous_backend_model_id: backendModelId,
    }
  }
}
