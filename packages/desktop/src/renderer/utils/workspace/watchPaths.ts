/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { absoluteToRelativePath } from '@/common/adapter/workspaceMapper';

/** Normalize paths for cross-platform workspace watch comparisons. */
export function normalizeWatchPath(value: string): string {
  const normalized = value.replaceAll('\\', '/');

  if (normalized === '/private/var') return '/var';
  if (normalized.startsWith('/private/var/')) return normalized.slice('/private'.length);
  if (normalized === '/private/tmp') return '/tmp';
  if (normalized.startsWith('/private/tmp/')) return normalized.slice('/private'.length);

  return normalized;
}

/** Workspace-relative path for a file (empty string when at workspace root). */
export function getFileRelativePath(filePath: string, workspace: string): string {
  const rel = absoluteToRelativePath(normalizeWatchPath(filePath), normalizeWatchPath(workspace));
  return rel === '.' ? '' : rel;
}

/** Parent directory of a file within the workspace, or null when the file is at root. */
export function getParentDirectory(
  filePath: string,
  workspace: string
): { fullPath: string; relativePath: string } | null {
  const fileRel = getFileRelativePath(filePath, workspace);
  if (!fileRel || !fileRel.includes('/')) {
    return null;
  }

  const parentRel = fileRel.slice(0, fileRel.lastIndexOf('/'));
  const sep = workspace.includes('\\') ? '\\' : '/';
  const ws = workspace.replace(/[/\\]+$/, '');
  return {
    relativePath: parentRel,
    fullPath: `${ws}${sep}${parentRel.replace(/\//g, sep)}`,
  };
}

/** All ancestor directory relative paths for tree expansion (e.g. notes/sub/file → ['notes', 'notes/sub']). */
export function getAncestorRelativePaths(fileRelativePath: string): string[] {
  if (!fileRelativePath || !fileRelativePath.includes('/')) {
    return [];
  }

  const parts = fileRelativePath.split('/');
  parts.pop();
  const ancestors: string[] = [];
  for (let i = 1; i <= parts.length; i++) {
    ancestors.push(parts.slice(0, i).join('/'));
  }
  return ancestors;
}

/** Stable debounce key for per-parent push refresh scheduling. */
export function getParentRefreshKey(filePath: string, workspace: string): string {
  const parent = getParentDirectory(filePath, workspace);
  return parent?.relativePath ?? '__root__';
}
