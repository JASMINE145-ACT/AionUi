/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from 'vitest';
import {
  hasStructuredPriceColumn,
  parseAskUserOption,
  parseAskUserOptionDescription,
  shouldRenderAskUserTable,
} from '@/renderer/pages/conversation/Messages/acp/askUserQuestionFormat';

describe('askUserQuestionFormat', () => {
  test('parseAskUserOption extracts code, B档 price, and note', () => {
    const parsed = parseAskUserOption(
      'PVC-U 排水 (白色)',
      '编码 8020020755, B档 1,219 IDR。适合排水/排污场景，最常用。'
    );
    expect(parsed.code).toBe('8020020755');
    expect(parsed.priceDisplay).toBe('1,219 IDR');
    expect(parsed.note).toBe('适合排水/排污场景，最常用');
  });

  test('parseAskUserOption extracts 单价 印尼盾 format', () => {
    const parsed = parseAskUserOption(
      'PVC-U 排水 直通 dn50 白色',
      '编码 8020020755，单价 1219 印尼盾，标准常用款'
    );
    expect(parsed.code).toBe('8020020755');
    expect(parsed.priceDisplay).toBe('1219 印尼盾');
    expect(parsed.note).toBe('标准常用款');
  });

  test('parseAskUserOptionDescription strips structured fields', () => {
    expect(
      parseAskUserOptionDescription('编码 8010024812, B档 8,410 IDR。适合给水/有压场景。')
    ).toBe('适合给水/有压场景');
    expect(parseAskUserOptionDescription('编码 8020020755，单价 1219 印尼盾，标准常用款')).toBe('标准常用款');
  });

  test('shouldRenderAskUserTable when most rows have 编码 or price', () => {
    expect(
      shouldRenderAskUserTable([
        { label: 'A', description: '编码 111, B档 100 IDR。说明A' },
        { label: 'B', description: '编码 222, B档 200 IDR。说明B' },
      ])
    ).toBe(true);
    expect(
      shouldRenderAskUserTable([
        { label: 'A', description: '编码 111，单价 1219 印尼盾，说明A' },
        { label: 'B', description: '编码 222，单价 2000 印尼盾，说明B' },
      ])
    ).toBe(true);
    expect(shouldRenderAskUserTable([{ label: 'Only one' }])).toBe(false);
  });

  test('hasStructuredPriceColumn detects price patterns', () => {
    expect(hasStructuredPriceColumn([{ label: 'A', description: '单价 1219 印尼盾' }])).toBe(true);
    expect(hasStructuredPriceColumn([{ label: 'A', description: 'plain text only' }])).toBe(false);
  });
});
