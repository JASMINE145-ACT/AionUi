/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { useCcbAuthorityActive } from '@/renderer/hooks/agent/useCcbModelInfo';
import { Message } from '@arco-design/web-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'precipitation.coldStart.notifiedAt';

/** On app load, remind once if pending precipitation items exist. */
export function usePrecipitationColdStartToast(): void {
  const { active } = useCcbAuthorityActive();
  const { t } = useTranslation();
  const ran = useRef(false);

  useEffect(() => {
    if (!active || ran.current) return;
    ran.current = true;
    void (async () => {
      try {
        const summary = await ipcBridge.ccbPrecipitationService.getSummary.invoke();
        if (!summary?.pendingCount) return;
        const last = localStorage.getItem(STORAGE_KEY);
        const updated = summary.updatedAt ?? summary.lastRunAt ?? String(summary.pendingCount);
        if (last === updated) return;
        localStorage.setItem(STORAGE_KEY, updated);
        Message.info({
          content: t('memory.inbox.coldStartBody', {
            defaultValue: '有 {{count}} 条对话沉淀待确认',
            count: summary.pendingCount,
          }),
          duration: 6000,
        });
      } catch {
        // ignore
      }
    })();
  }, [active, t]);
}
