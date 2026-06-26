/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ccbModelService } from '@/common/adapter/ipcBridge'
import type { CcbModelInfo } from '@/common/config/ccbModelSettingsShared'
import useSWR from 'swr'

const CCB_MODEL_INFO_KEY = ['ccb-model-info'] as const

const CCB_AUTHORITY_ACTIVE_KEY = ['ccb-authority-active'] as const

export function useCcbAuthorityActive(enabled = true) {
  const { data, isLoading } = useSWR<boolean>(
    enabled ? CCB_AUTHORITY_ACTIVE_KEY : null,
    () => ccbModelService.isAuthorityActive.invoke(),
    { revalidateOnFocus: true }
  )

  return {
    active: data === true,
    isLoading,
  }
}

export function useCcbModelInfo(enabled = true) {
  const { data, mutate, isLoading } = useSWR<CcbModelInfo | null>(
    enabled ? CCB_MODEL_INFO_KEY : null,
    async () => {
      const active = await ccbModelService.isAuthorityActive.invoke()
      if (!active) {
        return null
      }
      return ccbModelService.getModelInfo.invoke()
    },
    { revalidateOnFocus: true }
  )

  return {
    modelInfo: data ?? null,
    isLoading,
    refresh: () => mutate(),
  }
}
