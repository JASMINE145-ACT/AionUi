/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * CCB-Wanding install/config snapshot for conversation continuity (upgrade refresh).
 */

export type CcbContinuitySnapshot = {
  /** From install seed/config-ship-manifest.json */
  ship_config_generation: number;
  /** From %LOCALAPPDATA%/CCB-Wanding/.claude/.config-generation.json */
  user_config_generation: number;
  /** From install dist/VERSION (CCB-Wanding package semver) */
  installed_version: string | null;
  /** Electron app.getVersion() */
  app_version: string;
  /** SHA-256 of wanding_business_knowledge.md (quotation SP2) */
  kb_content_hash: string;
};

export const CONTINUITY_EXTRA_KEYS = {
  last_bound_config_generation: 'last_bound_config_generation',
  last_bound_app_version: 'last_bound_app_version',
} as const;

export type KnowledgeContinuityState = {
  kb_content_hash: string;
  read_at_generation: number;
  match_count_since_read: number;
  invalidated: boolean;
  invalidated_reason?: string | null;
};

export const KNOWLEDGE_EXTRA_KEYS = {
  kb_content_hash: 'knowledge_kb_content_hash',
  read_at_generation: 'knowledge_read_at_generation',
  match_count_since_read: 'knowledge_match_count_since_read',
  invalidated: 'knowledge_invalidated',
  invalidated_reason: 'knowledge_invalidated_reason',
} as const;
