/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NormalizedToolCall } from './normalizeToolCall';

export type GroupedToolCalls = {
  topLevel: NormalizedToolCall[];
  childrenByParent: Map<string, NormalizedToolCall[]>;
};

const appendChild = (
  childrenByParent: Map<string, NormalizedToolCall[]>,
  parentKey: string,
  child: NormalizedToolCall
) => {
  const list = childrenByParent.get(parentKey) ?? [];
  list.push(child);
  childrenByParent.set(parentKey, list);
};

/**
 * Build a parent/child tree for View Steps.
 * 1) Prefer explicit `parentToolUseId` from the backend.
 * 2) Fallback: nest orphan steps that immediately follow an Agent() delegation.
 * 3) Backfill: nest leading orphans that arrived before the Agent row (common in dev/live ACP ordering).
 */
export function groupNormalizedToolCalls(tools: NormalizedToolCall[]): GroupedToolCalls {
  const keys = new Set(tools.map((tool) => tool.key));
  const childrenByParent = new Map<string, NormalizedToolCall[]>();
  const childKeys = new Set<string>();
  const fallbackChildKeys = new Set<string>();

  for (const item of tools) {
    if (item.parentToolUseId) {
      childKeys.add(item.key);
      appendChild(childrenByParent, item.parentToolUseId, item);
    }
  }

  const topLevel: NormalizedToolCall[] = [];
  let leadingOrphans: NormalizedToolCall[] = [];
  let activeAgentParent: NormalizedToolCall | null = null;

  for (const item of tools) {
    if (childKeys.has(item.key)) {
      continue;
    }

    if (item.isAgentDelegation) {
      for (const orphan of leadingOrphans) {
        childKeys.add(orphan.key);
        fallbackChildKeys.add(orphan.key);
        appendChild(childrenByParent, item.key, orphan);
      }
      leadingOrphans = [];
      topLevel.push(item);
      activeAgentParent = item;
      continue;
    }

    if (activeAgentParent) {
      childKeys.add(item.key);
      fallbackChildKeys.add(item.key);
      appendChild(childrenByParent, activeAgentParent.key, item);
      continue;
    }

    leadingOrphans.push(item);
  }

  for (const orphan of leadingOrphans) {
    topLevel.push(orphan);
  }

  if (process.env.NODE_ENV !== 'production' && tools.length > 0) {
    const explicitCount = childKeys.size - fallbackChildKeys.size;
    const summarizeTool = (tool: NormalizedToolCall) => ({
      key: tool.key,
      name: tool.name,
      kind: tool.kind,
      isAgentDelegation: tool.isAgentDelegation,
      subagentLabel: tool.subagentLabel,
      parentToolUseId: tool.parentToolUseId ?? null,
      nestedVia: childKeys.has(tool.key)
        ? fallbackChildKeys.has(tool.key)
          ? 'sequential-fallback'
          : 'parentToolUseId'
        : 'top-level',
    });
    console.debug('[toolCallGrouping]', {
      total: tools.length,
      topLevel: topLevel.length,
      explicitParentLinks: explicitCount,
      sequentialFallbackLinks: fallbackChildKeys.size,
      get tools() {
        return tools.map(summarizeTool);
      },
    });
  }

  return { topLevel, childrenByParent };
}
