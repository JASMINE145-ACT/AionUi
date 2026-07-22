/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/** Org-scoped data libraries shown under the Sider「数据库」fold group. */
export type OrgDatabaseNavItem = {
  id: string;
  path: string;
};

export const ORG_DATABASE_NAV_ITEMS: readonly OrgDatabaseNavItem[] = [
  { id: 'org-knowledge', path: '/org-knowledge' },
  { id: 'price-library', path: '/price-library' },
  { id: 'suppliers', path: '/suppliers' },
] as const;

export function isOrgDatabasePath(pathname: string): boolean {
  return ORG_DATABASE_NAV_ITEMS.some(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`)
  );
}

export const ORG_DATABASE_SECTION_EXPANDED_KEY = 'org-database-section-expanded';
