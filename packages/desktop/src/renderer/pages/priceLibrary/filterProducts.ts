/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PriceVersionItem } from '@/common/types/priceLibrary/priceLibraryTypes';

export function filterPriceProducts(products: PriceVersionItem[], query: string): PriceVersionItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return products;
  }
  return products.filter((row) => {
    const code = row.material_code?.toLowerCase() ?? '';
    const desc = row.description?.toLowerCase() ?? '';
    const descCn = row.description_cn?.toLowerCase() ?? '';
    const descEn = row.description_english?.toLowerCase() ?? '';
    const supplier = row.supplier?.toLowerCase() ?? '';
    return code.includes(q) || desc.includes(q) || descCn.includes(q) || descEn.includes(q) || supplier.includes(q);
  });
}

export function formatPriceCell(value?: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
