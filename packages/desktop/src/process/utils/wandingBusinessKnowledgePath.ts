/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Resolve local shadow path for wanding_business_knowledge.md (Agent Read + MCP file fallback).
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  resolveCcbInstallerRoot,
  resolveCcbWandingInstallDir,
} from '@/common/config/ccbWandingRuntimeNode';

export const WANDING_BUSINESS_KNOWLEDGE_FILENAME = 'wanding_business_knowledge.md';
export const WANDING_BUSINESS_KNOWLEDGE_SLUG = 'wanding_business_knowledge';

const vendorRelative = join('vendor', 'wanding', 'data', WANDING_BUSINESS_KNOWLEDGE_FILENAME);

/** Same resolution order as quotation MCP / ensure-wanding-settings.ps1. */
export function resolveWandingBusinessKnowledgeShadowPath(): string | null {
  const fromEnv = process.env.WANDING_BUSINESS_KNOWLEDGE_PATH?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const installDir = resolveCcbWandingInstallDir();
  if (installDir) {
    return join(installDir, vendorRelative);
  }

  const installerRoot = resolveCcbInstallerRoot();
  if (installerRoot) {
    return join(installerRoot, vendorRelative);
  }

  if (process.platform === 'win32') {
    const ccbRoot = 'D:\\CCB-Wanding';
    const fallback = join(ccbRoot, vendorRelative);
    if (existsSync(fallback) || existsSync(join(ccbRoot, 'dist'))) {
      return fallback;
    }
    return null;
  }

  return null;
}
