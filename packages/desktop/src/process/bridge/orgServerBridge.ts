/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcMain } from 'electron';
import {
  ensureOrgServerJsonFromEnv,
  readOrgServerUrl,
  writeOrgServerUrl,
  writeOrgSessionTokenFile,
} from '@process/utils/orgServerConfig';
import { writeWandingBusinessKnowledgeShadow } from '@process/utils/orgKnowledgeShadowSync';
import { registerOrgHttpProxyHandlers } from '@process/bridge/orgHttpProxy';
import { registerWorkTaskAttachmentHandlers } from '@process/bridge/workTaskAttachmentBridge';

ensureOrgServerJsonFromEnv();
registerOrgHttpProxyHandlers();
registerWorkTaskAttachmentHandlers();

ipcMain.on('get-org-server-url', (event) => {
  event.returnValue = readOrgServerUrl();
});

ipcMain.on('get-sso-mode', (event) => {
  event.returnValue = (process.env.AIONUI_SSO_MODE ?? '').trim();
});

ipcMain.on('get-bypass-auth', (event) => {
  event.returnValue = process.env.AIONUI_BYPASS_AUTH === '1';
});

ipcMain.on('get-force-relogin', (event) => {
  event.returnValue = process.env.AIONUI_FORCE_RELOGIN === '1';
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
