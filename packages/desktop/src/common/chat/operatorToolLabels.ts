/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NormalizedToolCall } from './normalizeToolCall';

const includesAny = (haystack: string, needles: string[]): boolean =>
  needles.some((needle) => haystack.includes(needle));

/**
 * Operator-facing View Steps label (Rudder §3.4.1 style).
 * Hides shell/MCP wrapper noise where a stable business label exists.
 */
export function formatOperatorToolLabel(item: NormalizedToolCall): string {
  const name = (item.name ?? '').trim();
  const desc = (item.description ?? '').trim();
  const combined = `${name} ${desc}`.toLowerCase();

  if (
    item.kind === 'read' ||
    /^read\b/i.test(name) ||
    includesAny(combined, ['wanding_business_knowledge', 'business_knowledge', 'org-knowledge', '知识库'])
  ) {
    return 'Read 业务知识库';
  }

  if (includesAny(combined, ['match_quotation', 'match_quotation_batch', '查价'])) {
    return '查价 MCP';
  }

  if (includesAny(combined, ['summarize', 'fetch_accurate', '账务'])) {
    return name || desc || '账务 MCP';
  }

  return name || desc || item.kind?.trim() || 'Tool';
}
