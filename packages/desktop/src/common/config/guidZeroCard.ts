/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * WANd.GUID.SINGLE_ENTRY.001 — Guid surface zero-card (G2 default **on**).
 * Does **not** empty Team / Settings / shared `fetchAssistantsCatalog`.
 */

import { STORAGE_KEYS } from './storageKeys';

function readLocalStorageFlag(key: string): boolean | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === '') return undefined;
    if (raw === '1' || raw.toLowerCase() === 'true') return true;
    if (raw === '0' || raw.toLowerCase() === 'false') return false;
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Guid 零卡 — default **true** (G2). Set `localStorage.ccb_guid_zero_card=0` to show cards again.
 * G1 used default false; G2 flips product default after D3 matrix PASS.
 */
export function isGuidZeroCardEnabled(): boolean {
  const fromStorage = readLocalStorageFlag(STORAGE_KEYS.CCB_GUID_ZERO_CARD);
  if (fromStorage !== undefined) return fromStorage;
  return true;
}

/** Guid-only list transform — empty when zero-card; identity otherwise. */
export function applyGuidZeroCardList<T>(items: T[]): T[] {
  return isGuidZeroCardEnabled() ? [] : items;
}
