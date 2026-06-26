/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import {
  deriveGuidWorkspaceFromFilePaths,
  parentDirFromFilePath,
} from '@/renderer/pages/guid/utils/deriveWorkspaceFromFilePath';

describe('deriveWorkspaceFromFilePath', () => {
  it('returns parent dir for Windows paths', () => {
    expect(parentDirFromFilePath('D:\\docs\\微信公众平台_files\\sheet.xlsx')).toBe(
      'D:\\docs\\微信公众平台_files'
    );
  });

  it('returns parent dir for POSIX paths', () => {
    expect(parentDirFromFilePath('/tmp/project/report.pdf')).toBe('/tmp/project');
  });

  it('derives workspace from first valid attachment path', () => {
    expect(
      deriveGuidWorkspaceFromFilePaths([
        'D:\\docs\\微信公众平台_files\\sheet.xlsx',
        'D:\\other\\b.txt',
      ])
    ).toBe('D:\\docs\\微信公众平台_files');
  });

  it('returns empty when no path has a parent', () => {
    expect(deriveGuidWorkspaceFromFilePaths(['', 'file-only'])).toBe('');
  });
});
