/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IDirOrFile } from '@/common/adapter/ipcBridge';
import { workspaceTreeHasVisibleContent } from '@/renderer/pages/conversation/Workspace/utils/treeHelpers';
import { describe, expect, it } from 'vitest';

describe('workspaceTreeHasVisibleContent', () => {
  it('returns false for empty tree', () => {
    expect(workspaceTreeHasVisibleContent([])).toBe(false);
  });

  it('returns true for root-level file nodes', () => {
    const nodes: IDirOrFile[] = [
      {
        name: 'report.md',
        fullPath: '/ws/report.md',
        relativePath: 'report.md',
        isFile: true,
        isDir: false,
      },
    ];
    expect(workspaceTreeHasVisibleContent(nodes)).toBe(true);
  });

  it('returns true for folder with children', () => {
    const nodes: IDirOrFile[] = [
      {
        name: 'research',
        fullPath: '/ws/research',
        relativePath: 'research',
        isDir: true,
        isFile: false,
        children: [
          {
            name: 'note.md',
            fullPath: '/ws/research/note.md',
            relativePath: 'research/note.md',
            isFile: true,
            isDir: false,
          },
        ],
      },
    ];
    expect(workspaceTreeHasVisibleContent(nodes)).toBe(true);
  });

  it('returns false for empty folder at root', () => {
    const nodes: IDirOrFile[] = [
      {
        name: 'research',
        fullPath: '/ws/research',
        relativePath: 'research',
        isDir: true,
        isFile: false,
        children: [],
      },
    ];
    expect(workspaceTreeHasVisibleContent(nodes)).toBe(false);
  });
});
