/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/** Parent directory of an absolute or relative file path (Windows + POSIX). */
export function parentDirFromFilePath(filePath: string): string {
  const normalized = filePath.trim();
  if (!normalized) {
    return '';
  }
  const sepIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  if (sepIndex <= 0) {
    return '';
  }
  return normalized.slice(0, sepIndex);
}

/** Guid Plan A: when no workspace is chosen, seed from the first attached file. */
export function deriveGuidWorkspaceFromFilePaths(filePaths: string[]): string {
  for (const filePath of filePaths) {
    const parent = parentDirFromFilePath(filePath);
    if (parent) {
      return parent;
    }
  }
  return '';
}
