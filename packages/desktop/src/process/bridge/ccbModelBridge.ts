/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common'
import { readCcbModelInfo } from '@/common/config/ccbModelSettings'
import { isCcbWandingInstallPresent } from '@/common/config/ccbWandingRuntimeNode'

export function initCcbModelBridge(): void {
  ipcBridge.ccbModelService.isAuthorityActive.provider(async () => isCcbWandingInstallPresent())
  ipcBridge.ccbModelService.getModelInfo.provider(async () => readCcbModelInfo())
}
