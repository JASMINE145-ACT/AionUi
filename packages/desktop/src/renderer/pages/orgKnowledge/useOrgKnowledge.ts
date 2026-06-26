/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import useSWR from 'swr';
import { ipcBridge } from '@/common';
import type {
  OrgKnowledgeDoc,
  OrgKnowledgeDocSummary,
  OrgKnowledgeRevisionSummary,
} from '@/common/types/orgKnowledge/orgKnowledgeTypes';
import { isOrgServerConfigured } from '@/common/adapter/orgHttpBridge';

export function useOrgKnowledgeList() {
  return useSWR(
    isOrgServerConfigured() ? 'org-knowledge.list' : null,
    () => ipcBridge.orgKnowledge.listDocs.invoke()
  );
}

export function useOrgKnowledgeDoc(slug: string | null) {
  return useSWR(
    slug && isOrgServerConfigured() ? ['org-knowledge.doc', slug] : null,
    () => ipcBridge.orgKnowledge.getDoc.invoke({ slug: slug! })
  );
}

export function useOrgKnowledgeHistory(slug: string | null) {
  return useSWR(
    slug && isOrgServerConfigured() ? ['org-knowledge.history', slug] : null,
    () => ipcBridge.orgKnowledge.listHistory.invoke({ slug: slug! })
  );
}

export async function saveOrgKnowledgeDoc(params: {
  slug: string;
  title: string;
  content: string;
  expected_version: number;
}): Promise<OrgKnowledgeDoc> {
  return ipcBridge.orgKnowledge.updateDoc.invoke(params);
}

export async function revertOrgKnowledgeDoc(params: {
  slug: string;
  target_version: number;
}): Promise<OrgKnowledgeDoc> {
  return ipcBridge.orgKnowledge.revertDoc.invoke(params);
}

export type { OrgKnowledgeDocSummary, OrgKnowledgeRevisionSummary };
