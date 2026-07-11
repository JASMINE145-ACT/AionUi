/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { useEffect, useState } from 'react';

const POLL_MS = 3000;

export function usePrecipitationSessionPending(
  conversationId: string | undefined,
  enabled: boolean
): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled || !conversationId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const rows = await ipcBridge.ccbPrecipitationService.listPending.invoke();
        if (cancelled) return;
        setCount(rows.filter((r) => r.conversationId === conversationId).length);
      } catch {
        if (!cancelled) setCount(0);
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [conversationId, enabled]);

  return count;
}
