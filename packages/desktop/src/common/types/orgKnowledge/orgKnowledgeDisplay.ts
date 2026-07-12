/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OrgKnowledgeRevisionSummary } from '@/common/types/orgKnowledge/orgKnowledgeTypes';

/** Legacy actor ids stored before username enrichment — display-friendly labels. */
export const ORG_KNOWLEDGE_LEGACY_USER_LABELS: Readonly<Record<string, string>> = {
  system_default_user: 'admin',
};

export type OrgKnowledgeUserLabelLookup = ReadonlyMap<string, string>;

export function historyNeedsUserLabelLookup(
  history: Pick<OrgKnowledgeRevisionSummary, 'updated_by' | 'updated_by_id'>[] | undefined
): boolean {
  if (!history?.length) return false;
  return history.some((item) => !item.updated_by?.username?.trim());
}

/** Display label for org-knowledge history updater (username preferred over raw id). */
export function getOrgKnowledgeUpdaterLabel(
  item: Pick<OrgKnowledgeRevisionSummary, 'updated_by' | 'updated_by_id'>,
  unknownLabel = '未知用户',
  userLabelById?: OrgKnowledgeUserLabelLookup
): string {
  const username = item.updated_by?.username?.trim();
  if (username) return username;

  const id = item.updated_by_id?.trim();
  if (id) {
    const fromMembers = userLabelById?.get(id);
    if (fromMembers) return fromMembers;
    const legacy = ORG_KNOWLEDGE_LEGACY_USER_LABELS[id];
    if (legacy) return legacy;
    return id;
  }

  return unknownLabel;
}

export function buildOrgKnowledgeUserLabelLookup(
  members: ReadonlyArray<{ id: string; username: string }>
): OrgKnowledgeUserLabelLookup {
  return new Map(members.map((member) => [member.id, member.username]));
}
