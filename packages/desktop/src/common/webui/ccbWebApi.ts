/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * WebUI browser fallbacks for CCB authority + agent catalog (Electron IPC unavailable).
 */

import { isWebUiBrowserMode } from '@/common/adapter/httpBridge';
import type { CcbAgentRecord } from '@/common/config/ccbAgents';

export async function fetchWebUiCcbAuthority(): Promise<boolean> {
  if (!isWebUiBrowserMode()) {
    return false;
  }

  const response = await fetch('/api/webui/ccb/authority', { credentials: 'include' });
  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as { active?: boolean };
  return data.active === true;
}

export async function fetchWebUiCcbAgents(): Promise<CcbAgentRecord[]> {
  if (!isWebUiBrowserMode()) {
    return [];
  }

  const response = await fetch('/api/webui/ccb/agents', { credentials: 'include' });
  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as { agents?: CcbAgentRecord[] };
  return Array.isArray(data.agents) ? data.agents : [];
}
