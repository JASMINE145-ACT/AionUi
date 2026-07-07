/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from 'vitest';
import {
  decodeAskUserMultiOptionId,
  decodeAskUserOptionId,
  encodeAskUserMultiOptionId,
  encodeAskUserOptionId,
  labelsFromAskUserOptionIds,
} from '@/renderer/pages/conversation/Messages/acp/askUserQuestionIds';

describe('askUserQuestionIds', () => {
  test('encode/decode single option id round-trip', () => {
    const id = encodeAskUserOptionId(1, 'PVC-U 排水');
    expect(id).toBe('auq:1:PVC-U%20%E6%8E%92%E6%B0%B4');
    expect(decodeAskUserOptionId(id)).toEqual({
      questionIndex: 1,
      label: 'PVC-U 排水',
    });
  });

  test('decodeAskUserOptionId returns null for malformed percent encoding', () => {
    expect(decodeAskUserOptionId('auq:0:%ZZ')).toBeNull();
  });

  test('encode/decode multi option id', () => {
    const id = encodeAskUserMultiOptionId(0, ['Feature A', 'Feature B']);
    expect(decodeAskUserMultiOptionId(id)).toEqual({
      questionIndex: 0,
      labels: ['Feature A', 'Feature B'],
    });
  });

  test('decodeAskUserMultiOptionId returns null for malformed segment', () => {
    expect(decodeAskUserMultiOptionId('auqm:0:%ZZ|Feature%20B')).toBeNull();
  });

  test('encode/decode multi option id with pipe in label', () => {
    const id = encodeAskUserMultiOptionId(0, ['A|B', 'C']);
    expect(decodeAskUserMultiOptionId(id)).toEqual({
      questionIndex: 0,
      labels: ['A|B', 'C'],
    });
  });

  test('labelsFromAskUserOptionIds', () => {
    const labels = labelsFromAskUserOptionIds([
      encodeAskUserOptionId(0, 'A'),
      encodeAskUserOptionId(0, 'B'),
    ]);
    expect(labels).toEqual(['A', 'B']);
  });

  test('labelsFromAskUserOptionIds skips malformed ids', () => {
    const labels = labelsFromAskUserOptionIds(['auq:0:%ZZ', encodeAskUserOptionId(0, 'OK')]);
    expect(labels).toEqual(['OK']);
  });
});
