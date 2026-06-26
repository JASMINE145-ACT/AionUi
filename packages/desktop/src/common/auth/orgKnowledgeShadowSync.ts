/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * After org login, pull wanding_business_knowledge from org API and write local shadow md
 * so Agent Read + MCP file fallback match the center server.
 */

import { ipcBridge } from '@/common';
import type { OrgKnowledgeDoc } from '@/common/types/orgKnowledge/orgKnowledgeTypes';

export const WANDING_BUSINESS_KNOWLEDGE_SLUG = 'wanding_business_knowledge';

export type OrgKnowledgeShadowSyncResult = {
  ok: boolean;
  path?: string;
  version?: number;
  reason?: string;
};

type ElectronInvoke = (channel: string, data?: unknown) => Promise<unknown>;

const getElectronInvoke = (): ElectronInvoke | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const api = (window as Window & { electronAPI?: { invokeIpc?: ElectronInvoke } }).electronAPI;
  return api?.invokeIpc ?? null;
};

export async function syncOrgKnowledgeShadowAfterLogin(): Promise<OrgKnowledgeShadowSyncResult> {
  return syncWandingBusinessKnowledgeShadow();
}

export async function writeWandingBusinessKnowledgeShadowFromDoc(
  doc: OrgKnowledgeDoc
): Promise<OrgKnowledgeShadowSyncResult> {
  const invoke = getElectronInvoke();
  if (!invoke) {
    return { ok: false, reason: 'no_electron_ipc' };
  }

  try {
    if (!doc?.content?.trim()) {
      return { ok: false, reason: 'empty_org_doc' };
    }

    const result = (await invoke('org-knowledge-sync-shadow', {
      content: doc.content,
      slug: doc.slug,
      version: doc.version,
    })) as OrgKnowledgeShadowSyncResult;

    if (result?.ok) {
      console.info('[orgKnowledgeShadowSync] synced', {
        path: result.path,
        version: result.version,
      });
    } else {
      console.warn('[orgKnowledgeShadowSync] skipped', result);
    }

    return result?.ok ? result : { ok: false, reason: result?.reason ?? 'sync_failed' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn('[orgKnowledgeShadowSync] failed', reason);
    return { ok: false, reason };
  }
}

export async function syncWandingBusinessKnowledgeShadow(): Promise<OrgKnowledgeShadowSyncResult> {
  try {
    const doc = await ipcBridge.orgKnowledge.getDoc.invoke({ slug: WANDING_BUSINESS_KNOWLEDGE_SLUG });
    return writeWandingBusinessKnowledgeShadowFromDoc(doc);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn('[orgKnowledgeShadowSync] fetch failed', reason);
    return { ok: false, reason };
  }
}
