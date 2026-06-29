/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';

/** Dev-mode resource dirs; first match with app icon assets wins. */
const DEV_RESOURCES_CANDIDATES = [
  path.join(process.cwd(), 'packages', 'desktop', 'resources'),
  path.join(process.cwd(), 'resources'),
];

/**
 * Resolve directory for app.png / app.ico in development.
 * Prefer `packages/desktop/resources` (build-wanding Sync-AionUiBrandAssets target).
 */
export function resolveDevResourcesDir(): string {
  const override = process.env.AIONUI_DEV_RESOURCES_DIR?.trim();
  if (override) {
    return override;
  }

  for (const dir of DEV_RESOURCES_CANDIDATES) {
    if (fs.existsSync(path.join(dir, 'app.png')) || fs.existsSync(path.join(dir, 'app.ico'))) {
      return dir;
    }
  }

  return DEV_RESOURCES_CANDIDATES[1]!;
}

export function resolveDevResourceFile(name: string): string | undefined {
  const override = process.env.AIONUI_DEV_RESOURCES_DIR?.trim();
  const candidates = override ? [override] : DEV_RESOURCES_CANDIDATES;

  for (const dir of candidates) {
    const filePath = path.join(dir, name);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return undefined;
}
