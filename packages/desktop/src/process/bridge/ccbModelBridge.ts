/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { app } from 'electron'
import { ipcBridge } from '@/common'
import { readCcbContinuitySnapshot } from '@/common/config/ccbContinuitySnapshot'
import { stageNextConversationId } from '@/common/config/ccbConversationIdentitySession'
import { writeConversationKnowledgeContinuityState } from '@/common/config/ccbKnowledgeContinuityNode'
import { readCcbModelInfo } from '@/common/config/ccbModelSettings'
import { isCcbWandingInstallPresent } from '@/common/config/ccbWandingRuntimeNode'

export function initCcbModelBridge(): void {
  ipcBridge.ccbModelService.isAuthorityActive.provider(async () => isCcbWandingInstallPresent())
  ipcBridge.ccbModelService.getModelInfo.provider(async () => readCcbModelInfo())
  ipcBridge.ccbModelService.getContinuitySnapshot.provider(async () =>
    readCcbContinuitySnapshot(app.getVersion())
  )
  ipcBridge.ccbModelService.syncKnowledgeContinuity.provider(async ({ conversation_id, state, session_id }) => {
    writeConversationKnowledgeContinuityState(conversation_id, state, session_id)
  })
  ipcBridge.ccbModelService.stageConversationIdentity.provider(async ({ conversation_id }) => {
    await stageNextConversationId(conversation_id)
  })
}
