/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Main-process CCB-Wanding model config reader (settings.json env + model).
 * Renderer must import from ccbModelSettingsShared.ts instead.
 */

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { resolveCcbClaudeConfigDir } from './ccbWandingRuntime'
import { isCcbWandingInstallPresent } from './ccbWandingRuntimeNode'
import {
  DEFAULT_CCB_MINIMAX_M3_VARIANT_ID,
  isCcbMiniMaxM3Settings,
  listCcbMiniMaxM3Variants,
  resolveCcbEffectiveModelId,
  type CcbModelInfo,
  type CcbSettingsJson,
} from './ccbModelSettingsShared'

export {
  CCB_MINIMAX_M3_CATALOG,
  DEFAULT_CCB_MINIMAX_M3_VARIANT_ID,
  isCcbMiniMaxM3Settings,
  listCcbMiniMaxM3Variants,
  resolveCcbEffectiveModelId,
  resolveDefaultCcbMiniMaxVariantId,
  type CcbModelCatalogEntry,
  type CcbModelInfo,
  type CcbSettingsJson,
} from './ccbModelSettingsShared'

async function readSettingsJson(configDir: string): Promise<CcbSettingsJson> {
  const settingsPath = join(configDir, 'settings.json')
  if (!existsSync(settingsPath)) {
    return {}
  }
  const raw = await readFile(settingsPath, 'utf8')
  return JSON.parse(raw.replace(/^\uFEFF/, '')) as CcbSettingsJson
}

export async function readCcbModelInfo(configDir = resolveCcbClaudeConfigDir()): Promise<CcbModelInfo | null> {
  if (!configDir || !isCcbWandingInstallPresent(configDir)) {
    return null
  }

  const settings = await readSettingsJson(configDir)
  const model_id = resolveCcbEffectiveModelId(settings, { fallback: DEFAULT_CCB_MINIMAX_M3_VARIANT_ID })
  if (!model_id) {
    return null
  }

  const env = settings.env ?? {}
  const available_variants = isCcbMiniMaxM3Settings(settings) ? listCcbMiniMaxM3Variants() : undefined
  return {
    model_id,
    model_label: model_id,
    base_url: env.ANTHROPIC_BASE_URL,
    model_type: typeof settings.modelType === 'string' ? settings.modelType : undefined,
    source: 'ccb-wanding',
    ...(available_variants ? { available_variants } : {}),
  }
}
