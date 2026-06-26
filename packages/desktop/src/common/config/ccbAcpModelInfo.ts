/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * CCB-Wanding model authority helpers for ACP UI. CCB owns switchable ids;
 * AionUI must not treat handshake effort tiers as the source of truth.
 */

import type { AcpModelInfo } from '@/common/types/platform/acpTypes'
import type { CcbModelInfo } from './ccbModelSettingsShared'
import { DEFAULT_CCB_MINIMAX_M3_VARIANT_ID, resolveDefaultCcbMiniMaxVariantId } from './ccbModelSettingsShared'

const MINIMAX_M3_BASE_IDS = new Set(['minimax-m3', 'minimax-m3-thinking', 'minimax-m3-low'])

/** Agents pinned to fast non-thinking M3 in CCB frontmatter (`model: minimax-m3`). */
export const CCB_FAST_M3_AGENT_IDS = new Set([
  'wande-orchestrator',
  'quotation-agent',
  'accurate-agent',
])

/** Strip effort suffix (e.g. minimax-m3/default -> minimax-m3). */
export function normalizeCcbMiniMaxModelId(modelId: string | null | undefined): string | null {
  if (!modelId) return null
  const trimmed = modelId.trim()
  const slash = trimmed.indexOf('/')
  const base = slash === -1 ? trimmed : trimmed.slice(0, slash)
  if (MINIMAX_M3_BASE_IDS.has(base)) return base
  if (trimmed.toLowerCase().startsWith('minimax-m3')) return 'minimax-m3'
  return trimmed
}

/** Preferred MiniMax variant for new CCB conversations (Thinking unless explicitly non-m3). */
export function resolveCcbNewConversationPreferredModelId(sourcePreference?: string | null): string {
  const normalized = normalizeCcbMiniMaxModelId(sourcePreference ?? undefined)
  if (!normalized || normalized === 'minimax-m3') {
    return DEFAULT_CCB_MINIMAX_M3_VARIANT_ID
  }
  return normalized
}

/**
 * Agent-aware variant for new CCB conversations.
 * Fast-M3 agents default to `minimax-m3` when no explicit variant is chosen;
 * an explicit Guid/session pick (`minimax-m3` or `minimax-m3-thinking`) always wins.
 */
export function resolveCcbNewConversationPreferredModelIdForAgent(
  agentId: string | undefined,
  sourcePreference?: string | null
): string {
  const normalized = normalizeCcbMiniMaxModelId(sourcePreference ?? undefined)
  const agentKey = agentId?.replace(/^builtin-/, '').trim()

  if (normalized === 'minimax-m3-thinking' || normalized === 'minimax-m3') {
    return normalized
  }

  if (agentKey && CCB_FAST_M3_AGENT_IDS.has(agentKey)) {
    return 'minimax-m3'
  }

  return resolveCcbNewConversationPreferredModelId(sourcePreference)
}

function ccbVariantIds(ccbModelInfo: CcbModelInfo | null | undefined): Set<string> {
  return new Set((ccbModelInfo?.available_variants ?? []).map((variant) => variant.model_id))
}

/** Session already exposes CCB variant ids (post session/new or setModel). */
export function sessionModelInfoHasCcbVariants(
  sessionInfo: AcpModelInfo | null | undefined,
  ccbModelInfo: CcbModelInfo | null | undefined
): boolean {
  const variantIds = ccbVariantIds(ccbModelInfo)
  if (variantIds.size === 0) return false
  return (sessionInfo?.available_models ?? []).some((model) => variantIds.has(model.id))
}

/**
 * When CCB exposes MiniMax-M3 variants, replace ACP effort-tier model lists
 * with the two selectable ids (minimax-m3 / minimax-m3-thinking).
 */
export function mergeCcbMiniMaxAcpModelInfo(
  handshakeInfo: AcpModelInfo | null | undefined,
  ccbModelInfo: CcbModelInfo | null | undefined
): AcpModelInfo | null {
  const variants = ccbModelInfo?.available_variants
  if (!variants?.length) {
    return handshakeInfo ?? null
  }

  const available_models = variants.map((variant) => ({
    id: variant.model_id,
    label: variant.model_label,
  }))

  const defaultVariantId = resolveDefaultCcbMiniMaxVariantId(variants)

  const rawCurrent =
    handshakeInfo?.current_model_id ?? ccbModelInfo?.model_id ?? defaultVariantId
  const normalized = normalizeCcbMiniMaxModelId(rawCurrent)
  const resolvedDefault = normalized ?? defaultVariantId
  const current_model_id = available_models.some((model) => model.id === resolvedDefault)
    ? resolvedDefault
    : defaultVariantId
  const current_model_label =
    available_models.find((model) => model.id === current_model_id)?.label ?? current_model_id

  return {
    current_model_id,
    current_model_label,
    available_models,
  }
}

/**
 * Resolve ACP model info under CCB authority.
 * - Switchable list always comes from CCB `available_variants`.
 * - `current_model_id` prefers the live session when it reports a variant id.
 */
export function resolveCcbAuthorityAcpModelInfo(
  sessionInfo: AcpModelInfo | null | undefined,
  ccbModelInfo: CcbModelInfo | null | undefined
): AcpModelInfo | null {
  const fromCcb = mergeCcbMiniMaxAcpModelInfo(null, ccbModelInfo)
  if (!fromCcb) {
    return sessionInfo ?? null
  }

  if (sessionInfo && sessionModelInfoHasCcbVariants(sessionInfo, ccbModelInfo)) {
    const normalizedCurrent =
      normalizeCcbMiniMaxModelId(sessionInfo.current_model_id) ?? fromCcb.current_model_id
    const current_model_label =
      fromCcb.available_models.find((model) => model.id === normalizedCurrent)?.label ??
      sessionInfo.current_model_label ??
      normalizedCurrent
    return {
      ...fromCcb,
      current_model_id: normalizedCurrent,
      current_model_label,
    }
  }

  if (sessionInfo?.current_model_id) {
    const normalizedCurrent =
      normalizeCcbMiniMaxModelId(sessionInfo.current_model_id) ?? fromCcb.current_model_id
    const current_model_label =
      fromCcb.available_models.find((model) => model.id === normalizedCurrent)?.label ?? normalizedCurrent
    return {
      ...fromCcb,
      current_model_id: normalizedCurrent,
      current_model_label,
    }
  }

  return fromCcb
}

/** True when CCB exposes more than one selectable variant. */
export function ccbHasSwitchableModelVariants(ccbModelInfo: CcbModelInfo | null | undefined): boolean {
  return (ccbModelInfo?.available_variants?.length ?? 0) > 1
}

/** Raw backend session model id (never UI-preserved). */
export function resolveBackendSessionModelId(
  sessionInfo: AcpModelInfo | null | undefined
): string | undefined {
  const raw = sessionInfo?.current_model_id
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return undefined
  }
  return normalizeCcbMiniMaxModelId(raw) ?? raw
}

/** Session-scoped model choice from Guid / conversation extra (not global acp.config). */
export function resolveCcbSessionPreferredModelId(extra?: {
  ccb_preferred_model_id?: string
  current_model_id?: string
}): string | undefined {
  const raw = extra?.ccb_preferred_model_id ?? extra?.current_model_id
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return undefined
  }
  return normalizeCcbMiniMaxModelId(raw) ?? raw
}

/**
 * When the backend reports a generic MiniMax upstream id (MiniMax-M3 / effort tier)
 * after the user explicitly chose a variant, keep the user selection for UI display.
 */
export function preserveCcbUserModelSelection(
  resolved: AcpModelInfo,
  sessionInfo: AcpModelInfo | null | undefined,
  userSelectedModelId: string | null | undefined
): AcpModelInfo {
  if (!userSelectedModelId) {
    return resolved
  }
  if (!resolved.available_models.some((model) => model.id === userSelectedModelId)) {
    return resolved
  }
  if (resolved.current_model_id === userSelectedModelId) {
    return resolved
  }

  const rawBackend = sessionInfo?.current_model_id ?? ''
  const normalizedBackend = normalizeCcbMiniMaxModelId(rawBackend)
  const backendLooksGeneric =
    !rawBackend ||
    rawBackend === 'MiniMax-M3' ||
    normalizedBackend === 'minimax-m3' ||
    rawBackend.includes('/')

  if (
    (userSelectedModelId === 'minimax-m3-thinking' || userSelectedModelId === 'minimax-m3') &&
    backendLooksGeneric
  ) {
    return {
      ...resolved,
      current_model_id: userSelectedModelId,
      current_model_label:
        resolved.available_models.find((model) => model.id === userSelectedModelId)?.label ??
        userSelectedModelId,
    }
  }

  return resolved
}
