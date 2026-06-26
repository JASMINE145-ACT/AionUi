/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcMain } from 'electron';
import {
  readOrgServerUrl,
  writeOrgServerUrl,
  writeOrgSessionTokenFile,
} from '@process/utils/orgServerConfig';
import { writeWandingBusinessKnowledgeShadow } from '@process/utils/orgKnowledgeShadowSync';

ipcMain.on('get-org-server-url', (event) => {
  event.returnValue = readOrgServerUrl();
});

ipcMain.handle('org-auth-write-token', (_event, payload: { token?: string | null }) => {
  writeOrgSessionTokenFile(payload?.token ?? null);
  return { success: true };
});

ipcMain.handle(
  'org-knowledge-sync-shadow',
  (_event, payload: { content?: string; slug?: string; version?: number }) => {
    return writeWandingBusinessKnowledgeShadow(payload?.content ?? '', {
      slug: payload?.slug,
      version: payload?.version,
    });
  }
);

ipcMain.handle('org-server-set-url', (_event, payload: { url: string }) => {
  writeOrgServerUrl(payload.url ?? '');
  return { success: true, url: readOrgServerUrl() };
});
