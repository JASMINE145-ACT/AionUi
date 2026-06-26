/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import {
  createCcbMcpServer,
  deleteCcbMcpServer,
  importCcbMcpServers,
  listCcbMcpServers,
  listCcbMcpServersWithHealth,
  testCcbMcpServer,
  toggleCcbMcpServer,
  updateCcbMcpServer,
} from '@/common/config/ccbMcpSettings';
import { repairCcbMcpHealth, runCcbMcpHealthCheck } from '@/common/config/ccbMcpHealth';
import { isCcbMcpAuthorityActive } from '@/common/config/ccbWandingRuntimeNode';
import type { IMcpServer } from '@/common/config/storage';

export function initCcbMcpBridge(): void {
  ipcBridge.ccbMcpService.isAuthorityActive.provider(async () => isCcbMcpAuthorityActive());

  ipcBridge.ccbMcpService.listServers.provider(async ({ test }) => {
    return listCcbMcpServersWithHealth(undefined, { test: Boolean(test) });
  });

  ipcBridge.ccbMcpService.createServer.provider(async (server) => {
    return createCcbMcpServer(server);
  });

  ipcBridge.ccbMcpService.updateServer.provider(async ({ id, data, previousName }) => {
    const existing =
      (await listCcbMcpServers()).find((server) => server.id === id) ??
      (previousName
        ? (await listCcbMcpServers()).find((server) => server.name === previousName)
        : undefined);
    if (!existing) {
      throw new Error(`MCP server "${id}" not found in CCB-Wanding settings`);
    }

    return updateCcbMcpServer(previousName ?? existing.name, {
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      transport: (data.transport ?? existing.transport) as IMcpServer['transport'],
      original_json: data.original_json ?? existing.original_json,
      enabled: data.enabled ?? existing.enabled,
    });
  });

  ipcBridge.ccbMcpService.deleteServer.provider(async ({ id }) => {
    await deleteCcbMcpServer(id);
  });

  ipcBridge.ccbMcpService.toggleServer.provider(async ({ id }) => {
    return toggleCcbMcpServer(id);
  });

  ipcBridge.ccbMcpService.importServers.provider(async ({ servers }) => {
    return importCcbMcpServers(servers);
  });

  ipcBridge.ccbMcpService.testConnection.provider(async ({ name }) => {
    return testCcbMcpServer(name);
  });

  ipcBridge.ccbMcpService.runHealthCheck.provider(async ({ probe }) => {
    return runCcbMcpHealthCheck({ probe: Boolean(probe) });
  });

  ipcBridge.ccbMcpService.repairHealth.provider(async ({ actionIds }) => {
    return repairCcbMcpHealth({ actionIds });
  });
}
