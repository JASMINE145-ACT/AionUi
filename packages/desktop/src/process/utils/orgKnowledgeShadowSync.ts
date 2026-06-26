/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Write org knowledge doc content to the local CCB-Wanding shadow markdown file.
 */

import fs from 'node:fs';
import path from 'node:path';

import { resolveWandingBusinessKnowledgeShadowPath } from './wandingBusinessKnowledgePath';

export type OrgKnowledgeShadowSyncResult = {
  ok: boolean;
  path?: string;
  version?: number;
  reason?: string;
};

function removeFileIfExists(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // best-effort cleanup
  }
}

function atomicWriteUtf8(target: string, content: string): void {
  const tmpPath = `${target}.org-sync.tmp`;
  try {
    fs.writeFileSync(tmpPath, content, { encoding: 'utf-8' });
    fs.renameSync(tmpPath, target);
  } catch (error) {
    removeFileIfExists(tmpPath);
    throw error;
  }
}

export function writeWandingBusinessKnowledgeShadow(
  content: string,
  meta?: { slug?: string; version?: number }
): OrgKnowledgeShadowSyncResult {
  const trimmed = content.trim();
  if (!trimmed) {
    return { ok: false, reason: 'empty_content' };
  }

  const target = resolveWandingBusinessKnowledgeShadowPath();
  if (!target) {
    return { ok: false, reason: 'shadow_path_unresolved' };
  }

  try {
    const dir = path.dirname(target);
    fs.mkdirSync(dir, { recursive: true });

    atomicWriteUtf8(target, trimmed);

    if (meta?.version != null) {
      const metaPath = `${target}.org-meta.json`;
      const metaTmpPath = `${metaPath}.org-sync.tmp`;
      const metaBody = JSON.stringify(
        {
          slug: meta.slug ?? 'wanding_business_knowledge',
          version: meta.version,
          synced_at: Date.now(),
        },
        null,
        2
      );
      try {
        fs.writeFileSync(metaTmpPath, metaBody, { encoding: 'utf-8' });
        fs.renameSync(metaTmpPath, metaPath);
      } catch (error) {
        removeFileIfExists(metaTmpPath);
        throw error;
      }
    }

    return { ok: true, path: target, version: meta?.version };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `io_error:${reason}` };
  }
}
