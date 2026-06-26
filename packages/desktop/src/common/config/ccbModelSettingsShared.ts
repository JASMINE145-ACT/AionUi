/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Browser/renderer-safe CCB model settings (no node:fs).
 */

/** Default MiniMax variant for new Guid/conversation sessions (Thinking). */
export const DEFAULT_CCB_MINIMAX_M3_VARIANT_ID = 'minimax-m3-thinking'

/** Display catalog entry for a CCB-Wanding selectable model (renderer-safe). */
export type CcbModelCatalogEntry = {
  model_id: string
  model_label: string
  /** i18n key resolved in renderer (settings namespace). */
  description_i18n_key: string
}

export const CCB_MINIMAX_M3_CATALOG: CcbModelCatalogEntry[] = [
  {
    model_id: 'minimax-m3',
    model_label: 'MiniMax M3',
    description_i18n_key: 'settings.ccbModelMinimaxM3Description',
  },
  {
    model_id: 'minimax-m3-thinking',
    model_label: 'MiniMax M3 (Thinking)',
    description_i18n_key: 'settings.ccbModelMinimaxM3ThinkingDescription',
  },
]

export function resolveDefaultCcbMiniMaxVariantId(
  variants?: Array<{ model_id: string; model_label: string }>
): string {
  if (variants?.some((variant) => variant.model_id === DEFAULT_CCB_MINIMAX_M3_VARIANT_ID)) {
    return DEFAULT_CCB_MINIMAX_M3_VARIANT_ID
  }
  return variants?.[0]?.model_id ?? DEFAULT_CCB_MINIMAX_M3_VARIANT_ID
}

export type CcbModelInfo = {
  model_id: string
  model_label: string
  base_url?: string
  model_type?: string
  source: 'ccb-wanding'
  /** When MiniMax-M3 is configured, independent catalog entries for settings / selectors. */
  available_variants?: CcbModelCatalogEntry[]
}

export type CcbSettingsJson = {
  model?: string
  modelType?: string
  env?: Record<string, string>
  [key: string]: unknown
}

/** Resolve active model id using the same precedence as route-b ACP launcher. */
export function resolveCcbEffectiveModelId(settings: CcbSettingsJson, options?: { fallback?: string }): string | null {
  const env = settings.env ?? {}
  const raw =
    env.ANTHROPIC_MODEL ||
    settings.model ||
    env.ANTHROPIC_DEFAULT_SONNET_MODEL ||
    env.ANTHROPIC_DEFAULT_OPUS_MODEL ||
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL ||
    options?.fallback

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null
  }

  const trimmed = raw.trim()
  return trimmed === 'default' ? DEFAULT_CCB_MINIMAX_M3_VARIANT_ID : trimmed
}

export function isCcbMiniMaxM3Settings(settings: CcbSettingsJson): boolean {
  const modelId = resolveCcbEffectiveModelId(settings, { fallback: DEFAULT_CCB_MINIMAX_M3_VARIANT_ID })
  const baseUrl = (settings.env?.ANTHROPIC_BASE_URL ?? '').toLowerCase()
  return Boolean(modelId?.toLowerCase().startsWith('minimax-m3') || baseUrl.includes('minimax'))
}

export function listCcbMiniMaxM3Variants(): CcbModelCatalogEntry[] {
  return CCB_MINIMAX_M3_CATALOG
}
