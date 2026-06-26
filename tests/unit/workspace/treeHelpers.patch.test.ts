/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IDirOrFile } from '@/common/adapter/ipcBridge';
import { patchDirectoryChildren } from '@/renderer/pages/conversation/Workspace/utils/treeHelpers';
import { describe, expect, it } from 'vitest';

describe('patchDirectoryChildren', () => {
  const rootTree: IDirOrFile[] = [
    {
      name: 'workspace',
      fullPath: '/ws',
      relativePath: '',
      isDir: true,
      isFile: false,
      children: [
        {
          name: 'notes',
          fullPath: '/ws/notes',
          relativePath: 'notes',
          isDir: true,
          isFile: false,
          children: [{ name: 'old.txt', fullPath: '/ws/notes/old.txt', relativePath: 'notes/old.txt', isFile: true, isDir: false }],
        },
      ],
    },
  ];

  it('replaces children of the target directory immutably', () => {
    const newChildren: IDirOrFile[] = [
      { name: 'new.xlsx', fullPath: '/ws/notes/new.xlsx', relativePath: 'notes/new.xlsx', isFile: true, isDir: false },
    ];

    const result = patchDirectoryChildren(rootTree, 'notes', newChildren);

    expect(result).not.toBe(rootTree);
    expect(rootTree[0]?.children?.[0]?.children).toHaveLength(1);
    expect(rootTree[0]?.children?.[0]?.children?.[0]?.name).toBe('old.txt');

    const notesNode = result[0]?.children?.find((n) => n.relativePath === 'notes');
    expect(notesNode?.children).toHaveLength(1);
    expect(notesNode?.children?.[0]?.name).toBe('new.xlsx');
  });

  it('returns unchanged tree when target is not found', () => {
    const result = patchDirectoryChildren(rootTree, 'missing', []);
    expect(result).toEqual(rootTree);
    expect(result).not.toBe(rootTree);
  });
});
