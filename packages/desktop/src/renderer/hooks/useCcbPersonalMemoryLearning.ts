/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { useEffect, useState } from 'react';

const POLL_MS = 1500;

/** Poll personal-memory learning status for Guid banner. */
export function useCcbPersonalMemoryLearning(enabled: boolean): boolean {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setShowBanner(false);
      return;
    }

    let cancelled = false;

    const tick = async () => {
      try {
        const status = await ipcBridge.ccbPersonalMemoryService.getLearningStatus.invoke();
        if (!cancelled) {
          setShowBanner(Boolean(status?.showBanner));
        }
      } catch {
        if (!cancelled) setShowBanner(false);
      }
    };

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  return showBanner;
}
