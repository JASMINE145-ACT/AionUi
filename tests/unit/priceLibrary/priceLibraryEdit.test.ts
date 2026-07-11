import { describe, expect, test } from 'vitest';
import type { PriceVersionItem } from '../../../packages/desktop/src/common/types/priceLibrary/priceLibraryTypes';
import {
  buildPriceFieldDiff,
  buildUpsertDraftItemPayload,
  editValuesFromItem,
} from '../../../packages/desktop/src/renderer/pages/priceLibrary/priceLibraryEdit';

const base: PriceVersionItem = {
  id: 'row-1',
  product_id: 'plp-001754',
  material_code: '001754',
  description: '½英寸(DN15)铁吊卡',
  description_cn: null,
  unit: 'pcs',
  supplier: 'PT Sanfu',
  price_a: null,
  price_b: null,
  price_c: 10,
  price_d: null,
  price_e: null,
};

describe('buildPriceFieldDiff', () => {
  test('returns empty when values unchanged', () => {
    const next = editValuesFromItem(base);
    expect(buildPriceFieldDiff(base, next)).toEqual([]);
  });

  test('detects price_b null → 1000', () => {
    const next = { ...editValuesFromItem(base), price_b: 1000 };
    expect(buildPriceFieldDiff(base, next)).toEqual([
      { field: 'price_b', before: null, after: 1000 },
    ]);
  });

  test('detects description change', () => {
    const next = { ...editValuesFromItem(base), description: 'new desc' };
    expect(buildPriceFieldDiff(base, next)).toEqual([
      { field: 'description', before: '½英寸(DN15)铁吊卡', after: 'new desc' },
    ]);
  });

  test('treats empty string as null clear for text fields', () => {
    const next = { ...editValuesFromItem(base), supplier: '' };
    expect(buildPriceFieldDiff(base, next)).toEqual([
      { field: 'supplier', before: 'PT Sanfu', after: null },
    ]);
  });
});

describe('buildUpsertDraftItemPayload', () => {
  test('returns null when no changes', () => {
    expect(buildUpsertDraftItemPayload(base, editValuesFromItem(base))).toBeNull();
  });

  test('includes change_type product_id material_code and only changed fields', () => {
    const payload = buildUpsertDraftItemPayload(base, {
      ...editValuesFromItem(base),
      price_b: 1000,
      supplier: 'Acme',
    });
    expect(payload).toEqual({
      change_type: 'update',
      product_id: 'plp-001754',
      material_code: '001754',
      fields: {
        material_code: '001754',
        price_b: 1000,
        supplier: 'Acme',
      },
    });
  });
});
