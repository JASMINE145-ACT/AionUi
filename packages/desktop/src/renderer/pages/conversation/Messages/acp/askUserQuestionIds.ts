/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Must stay in sync with claude-code-B src/services/acp/permissions.ts
 */

export function encodeAskUserOptionId(questionIndex: number, label: string): string {
  return `auq:${questionIndex}:${encodeURIComponent(label)}`;
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function decodeAskUserOptionId(
  optionId: string
): { questionIndex: number; label: string } | null {
  const match = /^auq:(\d+):(.+)$/.exec(optionId);
  if (!match) return null;
  const label = safeDecodeURIComponent(match[2]);
  if (label === null) return null;
  return {
    questionIndex: Number(match[1]),
    label,
  };
}

/** Multi-select confirm key — labels joined with ", " in backend answer. */
export function encodeAskUserMultiOptionId(questionIndex: number, labels: string[]): string {
  return `auqm:${questionIndex}:${labels.map((l) => encodeURIComponent(l)).join('|')}`;
}

export function decodeAskUserMultiOptionId(
  optionId: string
): { questionIndex: number; labels: string[] } | null {
  const match = /^auqm:(\d+):(.+)$/.exec(optionId);
  if (!match) return null;
  const parts = match[2].split('|');
  const labels: string[] = [];
  for (const part of parts) {
    const decoded = safeDecodeURIComponent(part);
    if (decoded === null || decoded.length === 0) return null;
    labels.push(decoded);
  }
  if (labels.length === 0) return null;
  return { questionIndex: Number(match[1]), labels };
}

export function labelsFromAskUserOptionIds(optionIds: string[]): string[] {
  return optionIds
    .map((id) => decodeAskUserOptionId(id)?.label)
    .filter((label): label is string => Boolean(label));
}
