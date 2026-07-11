/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import {
  decidePrecipitationProposal,
  listPrecipitationProposals,
  readPrecipitationSummary,
  schedulePrecipitation,
} from '@/common/config/ccbPrecipitation';

export function initCcbPrecipitationBridge(): void {
  ipcBridge.ccbPrecipitationService.getSummary.provider(async () => readPrecipitationSummary());

  ipcBridge.ccbPrecipitationService.listPending.provider(async () => listPrecipitationProposals());

  ipcBridge.ccbPrecipitationService.schedule.provider(async (input) => schedulePrecipitation(input));

  ipcBridge.ccbPrecipitationService.decide.provider(async (input) => decidePrecipitationProposal(input));
}
