/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ccbModelService } from '@/common/adapter/ipcBridge'
import { isWebUiBrowserMode } from '@/common/adapter/httpBridge'
import type { CcbModelInfo } from '@/common/config/ccbModelSettingsShared'
import { fetchWebUiCcbAuthority } from '@/common/webui/ccbWebApi'
import useSWR from 'swr'

const CCB_MODEL_INFO_KEY = ['ccb-model-info'] as const

const CCB_AUTHORITY_ACTIVE_KEY = ['ccb-authority-active'] as const

async function resolveCcbAuthorityActive(): Promise<boolean> {
  // WebUI: platform invoke never rejects — HTTP-first so SWR does not hang forever.
  if (isWebUiBrowserMode()) {
    return fetchWebUiCcbAuthority().catch(() => false)
  }

  try {
    return (await ccbModelService.isAuthorityActive.invoke()) === true
  } catch {
    return false
  }
}

export function useCcbAuthorityActive(enabled = true) {
  const { data, isLoading } = useSWR<boolean>(
    enabled ? CCB_AUTHORITY_ACTIVE_KEY : null,
    () => resolveCcbAuthorityActive(),
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
      const active = await resolveCcbAuthorityActive()
      if (!active) {
        return null
      }
      // WebUI: no model-info HTTP surface yet; skip Electron invoke (would hang).
      if (isWebUiBrowserMode()) {
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
