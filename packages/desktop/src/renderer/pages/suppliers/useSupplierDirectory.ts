/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import useSWR from 'swr';
import { ipcBridge } from '@/common';
import { isOrgServerConfigured } from '@/common/adapter/orgHttpBridge';
import type {
  UpsertLogisticsVehicleParams,
  UpsertSupplierParams,
} from '@/common/types/supplierDirectory/supplierDirectoryTypes';

export function useSuppliersList(q?: string, category?: string) {
  const key =
    isOrgServerConfigured()
      ? `supplier-directory.list:${q ?? ''}:${category ?? ''}`
      : null;
  return useSWR(key, () =>
    ipcBridge.supplierDirectory.listSuppliers.invoke({
      ...(q ? { q } : {}),
      ...(category ? { category } : {}),
    })
  );
}

export function useSupplierMatch(q: string, enabled: boolean) {
  const trimmed = q.trim();
  return useSWR(
    enabled && isOrgServerConfigured() && trimmed
      ? `supplier-directory.match:${trimmed}`
      : null,
    () => ipcBridge.supplierDirectory.matchProducts.invoke({ q: trimmed, top_n: 20 })
  );
}

export function useLogisticsVehicles() {
  return useSWR(isOrgServerConfigured() ? 'supplier-directory.vehicles' : null, () =>
    ipcBridge.supplierDirectory.listVehicles.invoke()
  );
}

export async function upsertSupplier(params: UpsertSupplierParams) {
  return ipcBridge.supplierDirectory.upsertSupplier.invoke(params);
}

export async function upsertVehicle(params: UpsertLogisticsVehicleParams) {
  return ipcBridge.supplierDirectory.upsertVehicle.invoke(params);
}
