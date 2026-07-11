/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import useSWR from 'swr';
import { ipcBridge } from '@/common';
import { isOrgServerConfigured } from '@/common/adapter/orgHttpBridge';
import { resolveIsOrgPriceAdmin } from '@/common/assistants/fetchAssistantsCatalog';
import type {
  PriceActiveResponse,
  PriceDraftResponse,
  PublishPriceDraftParams,
  PublishPriceDraftResult,
  UpsertPriceDraftItemParams,
} from '@/common/types/priceLibrary/priceLibraryTypes';

export function usePriceLibraryActive() {
  return useSWR(
    isOrgServerConfigured() ? 'price-library.active' : null,
    () => ipcBridge.priceLibrary.getActive.invoke()
  );
}

/** Draft GET — only for price_admin; 403 ⇒ treat as non-admin (null data + error). */
export function usePriceLibraryDraft(enabled: boolean) {
  return useSWR(
    enabled && isOrgServerConfigured() ? 'price-library.draft' : null,
    () => ipcBridge.priceLibrary.getDraft.invoke()
  );
}

export function useIsOrgPriceAdmin() {
  return useSWR(
    isOrgServerConfigured() ? 'price-library.is-admin' : null,
    () => resolveIsOrgPriceAdmin()
  );
}

export async function upsertPriceLibraryItem(params: UpsertPriceDraftItemParams): Promise<void> {
  await ipcBridge.priceLibrary.upsertItem.invoke(params);
}

export async function publishPriceLibraryDraft(
  params: PublishPriceDraftParams
): Promise<PublishPriceDraftResult> {
  return ipcBridge.priceLibrary.publishDraft.invoke(params);
}

export async function fetchPriceLibraryDraft(): Promise<PriceDraftResponse> {
  return ipcBridge.priceLibrary.getDraft.invoke();
}

export type { PriceActiveResponse, PriceDraftResponse };
