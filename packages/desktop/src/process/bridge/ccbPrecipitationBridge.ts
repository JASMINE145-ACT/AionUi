/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import {
  checkpointPrecipitationTurn,
  decidePrecipitationProposal,
  listPrecipitationProposals,
  readPrecipitationSummary,
  recordPrecipitationFunnelEvent,
  recoverTurnHarvestOnStartup,
  schedulePrecipitation,
} from '@/common/config/ccbPrecipitation';

export function initCcbPrecipitationBridge(): void {
  recoverTurnHarvestOnStartup();

  ipcBridge.ccbPrecipitationService.getSummary.provider(async () => readPrecipitationSummary());

  ipcBridge.ccbPrecipitationService.listPending.provider(async () => listPrecipitationProposals());

  ipcBridge.ccbPrecipitationService.schedule.provider(async (input) => schedulePrecipitation(input));

  ipcBridge.ccbPrecipitationService.checkpoint.provider(async (input) =>
    checkpointPrecipitationTurn(input)
  );

  ipcBridge.ccbPrecipitationService.recordEvent.provider(async (input) =>
    recordPrecipitationFunnelEvent(input)
  );

  ipcBridge.ccbPrecipitationService.decide.provider(async (input) => decidePrecipitationProposal(input));
}
