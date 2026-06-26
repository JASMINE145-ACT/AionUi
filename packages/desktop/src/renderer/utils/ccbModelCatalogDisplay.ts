/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CCB_MINIMAX_M3_CATALOG,
  type CcbModelCatalogEntry,
} from '@/common/config/ccbModelSettingsShared'
import type { TFunction } from 'i18next'

const DESCRIPTION_KEY_BY_MODEL_ID: Record<string, string> = {
  'minimax-m3': 'settings.ccbModelMinimaxM3Description',
  'minimax-m3-thinking': 'settings.ccbModelMinimaxM3ThinkingDescription',
}

const DESCRIPTION_DEFAULT_ZH: Record<string, string> = {
  'minimax-m3': '常规快速模式，适合报价、快速查询和工具密集型任务。',
  'minimax-m3-thinking': '深度分析模式，适合报告撰写、复杂推理和长上下文分析。',
}

/** Merge IPC variants with renderer catalog so description keys are always present. */
export function enrichCcbModelCatalogEntries(
  variants:
    | Array<
        Partial<CcbModelCatalogEntry> &
          Pick<CcbModelCatalogEntry, 'model_id' | 'model_label'> & {
            description_i18n_key?: string;
          }
      >
    | undefined,
  fallback: Pick<CcbModelCatalogEntry, 'model_id' | 'model_label'> & {
    description_i18n_key?: string;
  }
): CcbModelCatalogEntry[] {
  const source = variants?.length ? variants : [fallback]
  return source.map((entry) => {
    const catalog = CCB_MINIMAX_M3_CATALOG.find((item) => item.model_id === entry.model_id)
    return {
      model_id: entry.model_id,
      model_label: entry.model_label,
      description_i18n_key:
        entry.description_i18n_key ??
        catalog?.description_i18n_key ??
        DESCRIPTION_KEY_BY_MODEL_ID[entry.model_id] ??
        'settings.ccbModelGenericDescription',
    }
  })
}

export function resolveCcbModelDescription(modelId: string, t: TFunction): string {
  const key =
    DESCRIPTION_KEY_BY_MODEL_ID[modelId] ??
    CCB_MINIMAX_M3_CATALOG.find((item) => item.model_id === modelId)?.description_i18n_key ??
    'settings.ccbModelGenericDescription'
  return t(key, {
    defaultValue:
      DESCRIPTION_DEFAULT_ZH[modelId] ??
      '由 CCB-Wanding settings.json 配置的模型。',
  })
}
