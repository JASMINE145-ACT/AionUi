import { describe, expect, test } from 'vitest';
import { PRICE_LIBRARY_COLUMNS } from '../../../packages/desktop/src/common/types/priceLibrary/priceLibraryTypes';

describe('PRICE_LIBRARY_COLUMNS', () => {
  test('includes supplier as 42nd column before raw_json', () => {
    expect(PRICE_LIBRARY_COLUMNS).toHaveLength(42);
    const keys = PRICE_LIBRARY_COLUMNS.map((c) => c.key);
    expect(keys).toContain('supplier');
    expect(keys.indexOf('supplier')).toBe(keys.indexOf('volume') + 1);
    expect(keys[keys.length - 1]).toBe('raw_json');
  });
});
