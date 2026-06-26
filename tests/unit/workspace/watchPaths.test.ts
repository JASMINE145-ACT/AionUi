/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  getAncestorRelativePaths,
  getFileRelativePath,
  getParentDirectory,
  getParentRefreshKey,
  normalizeWatchPath,
} from '@/renderer/utils/workspace/watchPaths';

describe('watchPaths', () => {
  it('normalizeWatchPath converts backslashes', () => {
    expect(normalizeWatchPath('C:\\Users\\proj\\file.xlsx')).toBe('C:/Users/proj/file.xlsx');
  });

  it('getFileRelativePath returns workspace-relative path', () => {
    const ws = 'C:/workspace';
    expect(getFileRelativePath('C:/workspace/report.xlsx', ws)).toBe('report.xlsx');
    expect(getFileRelativePath('C:\\workspace\\notes\\a.txt', ws)).toBe('notes/a.txt');
  });

  it('getParentDirectory returns null for root-level files', () => {
    expect(getParentDirectory('C:/workspace/report.xlsx', 'C:/workspace')).toBeNull();
  });

  it('getParentDirectory returns parent for nested files', () => {
    const parent = getParentDirectory('C:/workspace/notes/report.xlsx', 'C:/workspace');
    expect(parent).toEqual({
      relativePath: 'notes',
      fullPath: 'C:/workspace/notes',
    });
  });

  it('getParentDirectory handles Windows separators in workspace', () => {
    const parent = getParentDirectory('C:\\workspace\\notes\\report.xlsx', 'C:\\workspace');
    expect(parent?.relativePath).toBe('notes');
    expect(parent?.fullPath).toBe('C:\\workspace\\notes');
  });

  it('getAncestorRelativePaths returns all ancestor dirs', () => {
    expect(getAncestorRelativePaths('notes/sub/file.txt')).toEqual(['notes', 'notes/sub']);
    expect(getAncestorRelativePaths('file.txt')).toEqual([]);
  });

  it('getParentRefreshKey uses __root__ for top-level files', () => {
    expect(getParentRefreshKey('C:/workspace/a.xlsx', 'C:/workspace')).toBe('__root__');
    expect(getParentRefreshKey('C:/workspace/notes/a.xlsx', 'C:/workspace')).toBe('notes');
  });
});
