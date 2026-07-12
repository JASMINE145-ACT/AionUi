/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type SupplierLocationEntry = {
  type: string;
  type_id: string;
  address: string;
  distance_km?: number | null;
  phone?: string;
  contact?: string;
};

export type SupplierProductGroup = {
  category: string;
  products: string[];
};

export type SupplierRow = {
  id: string;
  name_zh: string;
  name_key: string;
  code: string;
  category: string;
  products_text: string;
  products_json: string;
  products_summary: string;
  spec: string;
  tech_params: string;
  material: string;
  price_note: string;
  moq: string;
  lead_days: string;
  address: string;
  locations_json: string;
  contact: string;
  phone: string;
  whatsapp: string;
  email: string;
  qualification: string;
  notes: string;
  grade: string;
  distance_km: number | null;
  source: string;
  seed_version: number;
  seeded_at: number;
  created_at: number;
  updated_at: number;
};

export type SupplierListResponse = {
  total: number;
  items: SupplierRow[];
};

export type SupplierMatchHit = {
  id: string;
  name_zh: string;
  score: number;
  snippet: string;
  matched_products: string[];
  category: string;
  address: string;
  contact: string;
  phone: string;
  distance_km?: number | null;
};

export type SupplierMatchResponse = {
  query: string;
  total: number;
  items: SupplierMatchHit[];
};

export type LogisticsVehicleRow = {
  id: string;
  seed_key: string;
  sort_no: number;
  name_zh: string;
  name_id: string;
  load_zh: string;
  load_id: string;
  size_zh: string;
  size_id: string;
  use_zh: string;
  use_id: string;
  source: string;
  seed_version: number;
  seeded_at: number;
  created_at: number;
  updated_at: number;
};

export type LogisticsVehicleListResponse = {
  total: number;
  items: LogisticsVehicleRow[];
};

export type UpsertSupplierParams = {
  name_zh: string;
  code?: string;
  category?: string;
  products_text?: string;
  products_json?: string;
  spec?: string;
  tech_params?: string;
  material?: string;
  price_note?: string;
  moq?: string;
  lead_days?: string;
  address?: string;
  locations_json?: string;
  contact?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  qualification?: string;
  notes?: string;
  grade?: string;
  distance_km?: number | null;
};

export type UpsertLogisticsVehicleParams = {
  seed_key: string;
  sort_no?: number;
  name_zh?: string;
  name_id?: string;
  load_zh?: string;
  load_id?: string;
  size_zh?: string;
  size_id?: string;
  use_zh?: string;
  use_id?: string;
};

export type UpsertResult = {
  id: string;
  action: string;
  preserved_edit: boolean;
};

export function parseSupplierLocations(row: SupplierRow): SupplierLocationEntry[] {
  try {
    const parsed = JSON.parse(row.locations_json || '[]') as SupplierLocationEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseSupplierProductGroups(row: SupplierRow): SupplierProductGroup[] {
  try {
    const parsed = JSON.parse(row.products_json || '[]') as SupplierProductGroup[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function formatDistanceKm(km: number | null | undefined): string {
  if (km == null || Number.isNaN(km)) return '—';
  return `约${km}km`;
}

export function displayOrDash(value: string | null | undefined): string {
  const t = (value ?? '').trim();
  return t || '—';
}
