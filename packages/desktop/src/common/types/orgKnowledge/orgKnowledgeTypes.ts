/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OrgKnowledgeDocSummary {
  slug: string;
  title: string;
  version: number;
  updated_by_id: string;
  updated_by?: OrgKnowledgePublicUser | null;
  created_at: number;
  updated_at: number;
}

export interface OrgKnowledgeDoc {
  slug: string;
  title: string;
  content: string;
  version: number;
  updated_by_id: string;
  updated_by?: OrgKnowledgePublicUser | null;
  created_at: number;
  updated_at: number;
}

export interface OrgKnowledgePublicUser {
  id: string;
  username: string;
  work_task_role?: string;
}

export interface OrgKnowledgeRevisionSummary {
  id: string;
  slug: string;
  version: number;
  title: string;
  updated_by_id: string;
  updated_by?: OrgKnowledgePublicUser | null;
  change_kind: string;
  revert_from_version?: number | null;
  created_at: number;
}

export interface OrgKnowledgeRevision extends OrgKnowledgeRevisionSummary {
  content: string;
}

export interface UpdateOrgKnowledgeDocRequest {
  title: string;
  content: string;
  expected_version: number;
}

export interface RevertOrgKnowledgeDocRequest {
  target_version: number;
}
