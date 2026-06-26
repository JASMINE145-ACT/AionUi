/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IDirOrFile } from '@/common/adapter/ipcBridge';
import {
  getAncestorRelativePaths,
  getFileRelativePath,
  getParentDirectory,
  getParentRefreshKey,
  normalizeWatchPath,
} from '@/renderer/utils/workspace/watchPaths';
import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { patchDirectoryChildren } from '../utils/treeHelpers';

const PARENT_REFRESH_DEBOUNCE_MS = 300;

interface UseWorkspaceInstantRefreshOptions {
  workspace: string;
  conversation_id: string;
  setFiles: Dispatch<SetStateAction<IDirOrFile[]>>;
  setExpandedKeys: Dispatch<SetStateAction<string[]>>;
}

function extractChildrenForPatch(res: IDirOrFile[]): IDirOrFile[] {
  if (res.length === 1 && res[0].relativePath === '') {
    return res[0].children ?? [];
  }
  return res;
}

/**
 * Push-refresh workspace tree when backend office-watch detects new files.
 * Complements throttled full refresh in useWorkspaceEvents (agent tool calls).
 */
export function useWorkspaceInstantRefresh({
  workspace,
  conversation_id,
  setFiles,
  setExpandedKeys,
}: UseWorkspaceInstantRefreshOptions) {
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const trimmed = workspace?.trim();
    if (!trimmed) {
      return;
    }

    const normalizedWorkspace = normalizeWatchPath(trimmed);
    const timers = debounceTimersRef.current;

    const refreshParent = async (filePath: string) => {
      const parent = getParentDirectory(filePath, trimmed);
      const parentRel = parent?.relativePath ?? '';
      const loadPath = parent?.fullPath ?? trimmed;

      try {
        const res = await ipcBridge.conversation.getWorkspace.invoke({
          conversation_id,
          workspace: trimmed,
          path: loadPath,
        });
        const newChildren = extractChildrenForPatch(res);
        setFiles((prev) => patchDirectoryChildren(prev, parentRel, newChildren));

        const fileRel = getFileRelativePath(filePath, trimmed);
        const ancestors = getAncestorRelativePaths(fileRel);
        if (ancestors.length > 0) {
          setExpandedKeys((prev) => {
            const merged = new Set(prev);
            for (const key of ancestors) {
              merged.add(key);
            }
            return Array.from(merged);
          });
        }
      } catch (err) {
        console.warn('[useWorkspaceInstantRefresh] parent refresh failed', loadPath, err);
      }
    };

    const scheduleParentRefresh = (filePath: string) => {
      const key = getParentRefreshKey(filePath, trimmed);
      const existing = timers.get(key);
      if (existing) {
        clearTimeout(existing);
      }
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          void refreshParent(filePath);
        }, PARENT_REFRESH_DEBOUNCE_MS)
      );
    };

    const unsubscribe = ipcBridge.workspaceOfficeWatch.fileAdded.on((event) => {
      if (normalizeWatchPath(event.workspace) !== normalizedWorkspace) {
        return;
      }
      scheduleParentRefresh(event.file_path);
    });

    return () => {
      unsubscribe();
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, [workspace, conversation_id, setFiles, setExpandedKeys]);
}
