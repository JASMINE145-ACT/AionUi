/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { PrecipitationSummary } from '@/common/config/ccbPrecipitationTypes';
import { useEffect, useState } from 'react';

const POLL_MS = 2000;

export function usePrecipitationSummary(enabled: boolean): PrecipitationSummary | null {
  const [summary, setSummary] = useState<PrecipitationSummary | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSummary(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await ipcBridge.ccbPrecipitationService.getSummary.invoke();
        if (!cancelled) setSummary(next);
      } catch {
        if (!cancelled) setSummary(null);
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  return summary;
}
