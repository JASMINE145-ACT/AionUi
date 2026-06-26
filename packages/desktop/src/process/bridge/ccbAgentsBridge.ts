/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import {
  deleteCcbAgent,
  getCcbAgent,
  listCcbAgents,
  saveCcbAgent,
  type CcbAgentInput,
} from '@/common/config/ccbAgents';
import { stageNextSessionAgent } from '@/common/config/ccbAgentSession';

export function initCcbAgentsBridge(): void {
  ipcBridge.ccbAgentsService.listAgents.provider(async () => listCcbAgents());
  ipcBridge.ccbAgentsService.getAgent.provider(async ({ id }: { id: string }) => getCcbAgent(id));
  ipcBridge.ccbAgentsService.saveAgent.provider(async (agent: CcbAgentInput) => saveCcbAgent(agent));
  ipcBridge.ccbAgentsService.deleteAgent.provider(async ({ id }: { id: string }) => deleteCcbAgent(id));
  ipcBridge.ccbAgentsService.stageNextSessionAgent.provider(async ({ agent_id }: { agent_id: string }) => {
    await stageNextSessionAgent(agent_id);
  });
}
