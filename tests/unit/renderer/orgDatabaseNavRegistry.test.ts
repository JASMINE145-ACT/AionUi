import { describe, expect, test } from 'bun:test';
import {
  isOrgDatabasePath,
  ORG_DATABASE_NAV_ITEMS,
} from '../../../packages/desktop/src/renderer/components/layout/Sider/orgDatabaseNavRegistry';

describe('orgDatabaseNavRegistry', () => {
  test('registers knowledge, price library, and suppliers', () => {
    expect(ORG_DATABASE_NAV_ITEMS.map((i) => i.id)).toEqual([
      'org-knowledge',
      'price-library',
      'suppliers',
    ]);
  });

  test('isOrgDatabasePath matches library routes', () => {
    expect(isOrgDatabasePath('/org-knowledge')).toBe(true);
    expect(isOrgDatabasePath('/price-library')).toBe(true);
    expect(isOrgDatabasePath('/suppliers')).toBe(true);
    expect(isOrgDatabasePath('/suppliers/foo')).toBe(true);
  });

  test('isOrgDatabasePath rejects unrelated routes', () => {
    expect(isOrgDatabasePath('/tasks')).toBe(false);
    expect(isOrgDatabasePath('/memory')).toBe(false);
    expect(isOrgDatabasePath('/conversation/abc')).toBe(false);
    expect(isOrgDatabasePath('/org-users')).toBe(false);
  });
});
