/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MemoryScope } from '@/common/config/ccbMemoryFiles';

export type MemoryPageTab = MemoryScope | 'inbox';

export function isMemoryPageTab(value: string | null): value is MemoryPageTab {
  return value === 'personal' || value === 'business' || value === 'inbox';
}

export function memoryPageTabToScope(tab: MemoryPageTab): MemoryScope | null {
  if (tab === 'inbox') return null;
  return tab;
}
