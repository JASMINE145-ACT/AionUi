import { describe, expect, test } from 'vitest';
import { filterPriceProducts, formatPriceCell } from '../../../packages/desktop/src/renderer/pages/priceLibrary/filterProducts';
import type { PriceVersionItem } from '../../../packages/desktop/src/common/types/priceLibrary/priceLibraryTypes';

const rows: PriceVersionItem[] = [
  {
    id: '1',
    product_id: 'p1',
    material_code: 'PE-001',
    description: 'HDPE pipe',
    unit: 'm',
    price_a: 100,
  },
  {
    id: '2',
    product_id: 'p2',
    material_code: 'PVC-002',
    description: 'PVC fitting',
    unit: 'pc',
    price_b: 50,
  },
];

describe('filterPriceProducts', () => {
  test('returns all when query empty', () => {
    expect(filterPriceProducts(rows, '')).toHaveLength(2);
  });

  test('matches material code', () => {
    expect(filterPriceProducts(rows, 'pe-001')).toHaveLength(1);
  });

  test('matches description', () => {
    expect(filterPriceProducts(rows, 'fitting')).toHaveLength(1);
  });

  test('matches supplier', () => {
    const withSupplier: PriceVersionItem[] = [
      {
        id: '3',
        product_id: 'p3',
        material_code: 'X',
        description: 'x',
        unit: 'pc',
        supplier: 'ACME Corp',
      },
    ];
    expect(filterPriceProducts(withSupplier, 'acme')).toHaveLength(1);
  });
});

describe('formatPriceCell', () => {
  test('null shows dash', () => {
    expect(formatPriceCell(null)).toBe('—');
  });

  test('formats number', () => {
    expect(formatPriceCell(1234.5)).toContain('1');
  });
});
