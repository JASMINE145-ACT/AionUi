/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Map legacy / UI permission mode ids to ACP-selectable values per backend.
 * Claude/CCB: UI "YOLO" / legacy `yolo` must become `bypassPermissions`
 * before config-options setMode (AionCore rejects unknown values).
 */

import { getFullAutoMode } from '@/common/types/agent/agentModes';

const FULL_AUTO_ALIASES = new Set(['yolo', 'yoloNoSandbox']);

/**
 * Normalize a permission/session mode for the given ACP backend.
 * Empty input stays empty. Full-auto aliases resolve via getFullAutoMode.
 */
export function normalizeAcpPermissionMode(
  backend: string | undefined,
  value: string | null | undefined,
): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  if (FULL_AUTO_ALIASES.has(trimmed)) {
    return getFullAutoMode(backend ?? 'claude');
  }
  return trimmed;
}
