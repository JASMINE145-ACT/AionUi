/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ccbMcpService } from '@/common/adapter/ipcBridge';
import type { CcbStartupReadinessStatus } from '@/common/config/ccbStartupReadinessShared';
import { isCcbStartupSendAllowed } from '@/common/config/ccbStartupReadinessShared';
import { useCcbAuthorityActive } from '@/renderer/hooks/agent/useCcbModelInfo';
import { useCallback, useEffect, useState } from 'react';

const IDLE_STATUS: CcbStartupReadinessStatus = {
  phase: 'idle',
  config_ok: false,
  mcp_ok: false,
  soft_ready: false,
};

export function useCcbStartupReadiness() {
  const { active: ccbAuthorityActive, isLoading: authorityLoading } = useCcbAuthorityActive();
  const [status, setStatus] = useState<CcbStartupReadinessStatus>(IDLE_STATUS);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!ccbAuthorityActive) {
      setStatus({
        phase: 'ready',
        config_ok: true,
        mcp_ok: true,
        soft_ready: false,
      });
      return;
    }
    setLoading(true);
    try {
      const next = await ccbMcpService.getStartupReadiness.invoke();
      setStatus(next);
      if (next.phase !== 'ready' && next.phase !== 'error') {
        void ccbMcpService.ensureStartupReadiness.invoke().then(setStatus);
      }
    } catch (error) {
      console.error('[useCcbStartupReadiness] refresh failed:', error);
    } finally {
      setLoading(false);
    }
  }, [ccbAuthorityActive]);

  useEffect(() => {
    if (authorityLoading) return;
    void refresh();
  }, [authorityLoading, refresh]);

  useEffect(() => {
    if (!ccbAuthorityActive) return;
    if (status.phase === 'ready' || status.phase === 'error') return;
    const timer = window.setInterval(() => {
      void ccbMcpService.getStartupReadiness.invoke().then(setStatus);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ccbAuthorityActive, status.phase]);

  const canSend = !ccbAuthorityActive || isCcbStartupSendAllowed(status);
  const isPreparing =
    ccbAuthorityActive && (status.phase === 'config' || status.phase === 'mcp_warm' || status.phase === 'idle');

  return {
    status,
    loading: loading || authorityLoading,
    canSend,
    isPreparing,
    refresh,
    ccbAuthorityActive,
  };
}
