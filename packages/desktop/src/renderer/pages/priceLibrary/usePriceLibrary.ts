/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import useSWR from 'swr';
import { ipcBridge } from '@/common';
import { isOrgServerConfigured } from '@/common/adapter/orgHttpBridge';
import type { PriceActiveResponse } from '@/common/types/priceLibrary/priceLibraryTypes';

export function usePriceLibraryActive() {
  return useSWR(
    isOrgServerConfigured() ? 'price-library.active' : null,
    () => ipcBridge.priceLibrary.getActive.invoke()
  );
}

export type { PriceActiveResponse };
