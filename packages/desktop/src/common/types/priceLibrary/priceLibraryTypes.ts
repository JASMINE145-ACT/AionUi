/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/** Canonical product fields — matches data/data.Md + org API flatten. */
export interface PriceProductFields {
  source_file?: string | null;
  source_sheet?: string | null;
  source_row?: number | null;
  is_preferred_price?: boolean | null;
  superseded_by_source?: string | null;
  material_code: string;
  description: string;
  description_cn?: string | null;
  description_english?: string | null;
  product_type?: string | null;
  factory_inc_tax?: number | null;
  factory_exc_tax?: number | null;
  purchase_exc_tax?: number | null;
  profit_a?: number | null;
  price_a?: number | null;
  profit_b?: number | null;
  price_b?: number | null;
  profit_c?: number | null;
  price_c?: number | null;
  profit_d?: number | null;
  price_d?: number | null;
  profit_d_low?: number | null;
  price_d_low?: number | null;
  profit_e?: number | null;
  price_e?: number | null;
  local_profit?: number | null;
  local_exc_tax?: number | null;
  local_inc_tax?: number | null;
  rucika_pricelist_exc_vat11?: number | null;
  rucika_pricelist_inc_vat11?: number | null;
  rucika_discount?: number | null;
  rucika_quote_profit_1?: number | null;
  rucika_quote_price_1?: number | null;
  rucika_quote_profit_2?: number | null;
  rucika_quote_price_2?: number | null;
  pe_nominal_price?: number | null;
  pe_discount?: number | null;
  pe_factory_price?: number | null;
  unit: string;
  volume?: number | null;
  supplier?: string | null;
  raw_json?: string | null;
}

export interface PriceVersionSummary {
  id: string;
  version_number: number;
  published_by: string;
  published_at: number;
  reason: string;
  revision: number;
  item_count: number;
}

export type PriceVersionItem = PriceProductFields & {
  id: string;
  product_id: string;
};

export interface PriceActiveResponse {
  version: PriceVersionSummary | null;
  products: PriceVersionItem[];
}

/** Shared draft overlay — GET /api/price-library/draft (price_admin). */
export interface PriceDraftItem {
  product_id?: string | null;
  change_type?: string | null;
  material_code?: string | null;
  [key: string]: unknown;
}

export interface PriceDraftResponse {
  revision: number;
  items: PriceDraftItem[];
}

export type PriceDraftChangeType = 'update' | 'create' | 'delete' | 'restore';

export interface UpsertPriceDraftItemParams {
  change_type: PriceDraftChangeType;
  product_id?: string;
  material_code?: string;
  fields: Record<string, string | number | boolean | null>;
}

export interface PublishPriceDraftParams {
  reason: string;
  revision: number;
}

export interface PublishPriceDraftResult {
  version?: PriceVersionSummary | null;
  version_number?: number;
  [key: string]: unknown;
}

/** Display column config for the read-only table (matches xlsx header order). */
export interface PriceLibraryColumnDef {
  key: keyof PriceProductFields;
  titleKey: string;
  width?: number;
  isNumeric?: boolean;
}

export const PRICE_LIBRARY_COLUMNS: PriceLibraryColumnDef[] = [
  { key: 'source_file', titleKey: 'priceLibrary.column.sourceFile', width: 120 },
  { key: 'source_sheet', titleKey: 'priceLibrary.column.sourceSheet', width: 100 },
  { key: 'source_row', titleKey: 'priceLibrary.column.sourceRow', width: 80 },
  { key: 'is_preferred_price', titleKey: 'priceLibrary.column.isPreferred', width: 80 },
  { key: 'superseded_by_source', titleKey: 'priceLibrary.column.supersededBy', width: 100 },
  { key: 'material_code', titleKey: 'priceLibrary.column.material', width: 130 },
  { key: 'description', titleKey: 'priceLibrary.column.description', width: 200 },
  { key: 'description_cn', titleKey: 'priceLibrary.column.descriptionCn', width: 160 },
  { key: 'description_english', titleKey: 'priceLibrary.column.descriptionEn', width: 160 },
  { key: 'product_type', titleKey: 'priceLibrary.column.productType', width: 120 },
  { key: 'factory_inc_tax', titleKey: 'priceLibrary.column.factoryIncTax', width: 110, isNumeric: true },
  { key: 'factory_exc_tax', titleKey: 'priceLibrary.column.factoryExcTax', width: 110, isNumeric: true },
  { key: 'purchase_exc_tax', titleKey: 'priceLibrary.column.purchaseExcTax', width: 110, isNumeric: true },
  { key: 'profit_a', titleKey: 'priceLibrary.column.profitA', width: 90, isNumeric: true },
  { key: 'price_a', titleKey: 'priceLibrary.column.priceA', width: 100, isNumeric: true },
  { key: 'profit_b', titleKey: 'priceLibrary.column.profitB', width: 90, isNumeric: true },
  { key: 'price_b', titleKey: 'priceLibrary.column.priceB', width: 100, isNumeric: true },
  { key: 'profit_c', titleKey: 'priceLibrary.column.profitC', width: 90, isNumeric: true },
  { key: 'price_c', titleKey: 'priceLibrary.column.priceC', width: 100, isNumeric: true },
  { key: 'profit_d', titleKey: 'priceLibrary.column.profitD', width: 90, isNumeric: true },
  { key: 'price_d', titleKey: 'priceLibrary.column.priceD', width: 100, isNumeric: true },
  { key: 'profit_d_low', titleKey: 'priceLibrary.column.profitDLow', width: 90, isNumeric: true },
  { key: 'price_d_low', titleKey: 'priceLibrary.column.priceDLow', width: 100, isNumeric: true },
  { key: 'profit_e', titleKey: 'priceLibrary.column.profitE', width: 90, isNumeric: true },
  { key: 'price_e', titleKey: 'priceLibrary.column.priceE', width: 100, isNumeric: true },
  { key: 'local_profit', titleKey: 'priceLibrary.column.localProfit', width: 90, isNumeric: true },
  { key: 'local_exc_tax', titleKey: 'priceLibrary.column.localExcTax', width: 110, isNumeric: true },
  { key: 'local_inc_tax', titleKey: 'priceLibrary.column.localIncTax', width: 110, isNumeric: true },
  { key: 'rucika_pricelist_exc_vat11', titleKey: 'priceLibrary.column.rucikaExc', width: 110, isNumeric: true },
  { key: 'rucika_pricelist_inc_vat11', titleKey: 'priceLibrary.column.rucikaInc', width: 110, isNumeric: true },
  { key: 'rucika_discount', titleKey: 'priceLibrary.column.rucikaDiscount', width: 90, isNumeric: true },
  { key: 'rucika_quote_profit_1', titleKey: 'priceLibrary.column.rucikaProfit1', width: 90, isNumeric: true },
  { key: 'rucika_quote_price_1', titleKey: 'priceLibrary.column.rucikaPrice1', width: 100, isNumeric: true },
  { key: 'rucika_quote_profit_2', titleKey: 'priceLibrary.column.rucikaProfit2', width: 90, isNumeric: true },
  { key: 'rucika_quote_price_2', titleKey: 'priceLibrary.column.rucikaPrice2', width: 100, isNumeric: true },
  { key: 'pe_nominal_price', titleKey: 'priceLibrary.column.peNominal', width: 110, isNumeric: true },
  { key: 'pe_discount', titleKey: 'priceLibrary.column.peDiscount', width: 90, isNumeric: true },
  { key: 'pe_factory_price', titleKey: 'priceLibrary.column.peFactory', width: 110, isNumeric: true },
  { key: 'unit', titleKey: 'priceLibrary.column.unit', width: 64 },
  { key: 'volume', titleKey: 'priceLibrary.column.volume', width: 80, isNumeric: true },
  { key: 'supplier', titleKey: 'priceLibrary.column.supplier', width: 180 },
  { key: 'raw_json', titleKey: 'priceLibrary.column.rawJson', width: 120 },
];
