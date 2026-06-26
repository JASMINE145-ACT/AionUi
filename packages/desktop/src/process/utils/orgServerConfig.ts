/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Persist ORG_SERVER_URL for renderer preload (organization aioncore).
 */

import fs from 'node:fs';
import path from 'node:path';

import { getDataPath } from './utils';

const CONFIG_FILE = 'org-server.json';

export type OrgServerConfig = {
  url: string;
};

function configPath(): string {
  return path.join(getDataPath(), CONFIG_FILE);
}

export function readOrgServerUrl(): string {
  const fromEnv = process.env.ORG_SERVER_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }

  try {
    const raw = fs.readFileSync(configPath(), 'utf-8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw) as OrgServerConfig;
    return (parsed.url ?? '').trim().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function writeOrgServerUrl(url: string): void {
  const normalized = url.trim().replace(/\/$/, '');
  const dir = getDataPath();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify({ url: normalized }, null, 2), 'utf-8');
}

export function getOrgSessionTokenFilePath(): string {
  return path.join(getDataPath(), 'org-session.token');
}

export function writeOrgSessionTokenFile(token: string | null): void {
  const filePath = getOrgSessionTokenFilePath();
  if (!token) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, token, 'utf-8');
}
