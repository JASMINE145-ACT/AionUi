/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import {
  getAttentionUnreadCountSnapshot,
  subscribeConversationListSync,
} from '@/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync';
import { isElectronDesktop, isWindows } from '@renderer/utils/platform';
import { useEffect, useSyncExternalStore } from 'react';

/**
 * Syncs attention unread conversation count to the Windows taskbar badge.
 * Independent of system toast settings (same as sidebar blue dots).
 */
export const useTaskbarAttentionBadge = (): void => {
  const count = useSyncExternalStore(
    subscribeConversationListSync,
    getAttentionUnreadCountSnapshot,
    () => 0,
  );

  useEffect(() => {
    if (!isElectronDesktop() || !isWindows()) {
      return;
    }

    void ipcBridge.appBadge.setCount.invoke({ count });
  }, [count]);
};
