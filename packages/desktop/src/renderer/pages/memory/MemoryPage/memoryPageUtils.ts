/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MemoryFileSummary } from '@/common/config/ccbMemoryFiles';

export function formatMemoryFileTime(mtimeMs: number): string {
  const date = new Date(mtimeMs);
  const now = Date.now();
  const diffMs = now - mtimeMs;
  const oneDay = 86_400_000;

  if (diffMs < oneDay) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  if (diffMs < oneDay * 7) {
    return date.toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function countLines(content: string): number {
  if (!content) return 0;
  return content.split('\n').length;
}

export type MemoryFileKind = 'profile' | 'workflow' | 'default';

export function getMemoryFileKind(name: string): MemoryFileKind {
  const lower = name.toLowerCase();
  if (lower.includes('profile')) return 'profile';
  if (lower.includes('workflow')) return 'workflow';
  return 'default';
}

export function getMemoryFileDescriptionKey(file: MemoryFileSummary): string {
  const kind = getMemoryFileKind(file.name);
  if (kind === 'profile') return 'memory.fileDesc.profile';
  if (kind === 'workflow') return 'memory.fileDesc.workflow';
  return 'memory.fileDesc.default';
}
