/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PriceProductFields, PriceVersionItem } from '@/common/types/priceLibrary/priceLibraryTypes';

/** P0 editable fields for L2 row drawer (v1). */
export const PRICE_LIBRARY_EDIT_FIELDS = [
  'price_a',
  'price_b',
  'price_c',
  'price_d',
  'price_e',
  'description',
  'description_cn',
  'supplier',
  'unit',
] as const satisfies ReadonlyArray<keyof PriceProductFields>;

export type PriceLibraryEditField = (typeof PRICE_LIBRARY_EDIT_FIELDS)[number];

export type PriceLibraryEditValues = Partial<Record<PriceLibraryEditField, string | number | null>>;

export interface PriceFieldDiffRow {
  field: PriceLibraryEditField;
  before: string | number | boolean | null | undefined;
  after: string | number | null;
}

function normalizeComparable(
  field: PriceLibraryEditField,
  value: string | number | boolean | null | undefined
): string | number | null {
  if (value == null || value === '') {
    return null;
  }
  if (field.startsWith('price_')) {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return String(value);
}

/** Build before/after rows for fields that actually changed. */
export function buildPriceFieldDiff(
  original: PriceVersionItem,
  next: PriceLibraryEditValues
): PriceFieldDiffRow[] {
  const rows: PriceFieldDiffRow[] = [];
  for (const field of PRICE_LIBRARY_EDIT_FIELDS) {
    if (!(field in next)) {
      continue;
    }
    const before = normalizeComparable(field, original[field] as string | number | boolean | null | undefined);
    const after = normalizeComparable(field, next[field]);
    if (before === after) {
      continue;
    }
    rows.push({ field, before: original[field] as string | number | boolean | null | undefined, after });
  }
  return rows;
}

/** POST /draft/items body: change_type + product_id + only changed updatable fields. */
export function buildUpsertDraftItemPayload(
  original: PriceVersionItem,
  next: PriceLibraryEditValues
): {
  change_type: 'update';
  product_id: string;
  material_code: string;
  fields: Record<string, string | number | null>;
} | null {
  const diff = buildPriceFieldDiff(original, next);
  if (diff.length === 0) {
    return null;
  }
  const fields: Record<string, string | number | null> = {
    material_code: original.material_code,
  };
  for (const row of diff) {
    fields[row.field] = row.after;
  }
  return {
    change_type: 'update',
    product_id: original.product_id,
    material_code: original.material_code,
    fields,
  };
}

export function editValuesFromItem(item: PriceVersionItem): PriceLibraryEditValues {
  const values: PriceLibraryEditValues = {};
  for (const field of PRICE_LIBRARY_EDIT_FIELDS) {
    const v = item[field];
    if (v == null) {
      values[field] = null;
    } else if (typeof v === 'boolean') {
      continue;
    } else {
      values[field] = v;
    }
  }
  return values;
}
