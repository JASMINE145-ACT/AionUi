/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { useEffect } from 'react';

interface UseWorkspaceWatchLifecycleOptions {
  workspace: string;
  conversation_id: string;
}

/**
 * Owns workspace file-system watch lifecycle for the Workspace panel.
 * Independent of auto-preview settings so the file tree stays in sync.
 */
export function useWorkspaceWatchLifecycle({ workspace, conversation_id }: UseWorkspaceWatchLifecycleOptions) {
  useEffect(() => {
    const trimmed = workspace?.trim();
    if (!trimmed) {
      return;
    }

    let cancelled = false;

    const startWatch = async () => {
      try {
        await ipcBridge.workspaceWatch.start.invoke({
          workspace: trimmed,
          conversation_id,
        });
      } catch (err) {
        if (!cancelled) {
          console.warn('[useWorkspaceWatchLifecycle] failed to start watch', trimmed, err);
        }
      }
    };

    void startWatch();

    return () => {
      cancelled = true;
      void ipcBridge.workspaceWatch.stop.invoke({ workspace: trimmed }).catch(() => {});
    };
  }, [workspace, conversation_id]);
}
