/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpAskUserQuestionOption } from '@/common/types/platform/acpTypes';

export type ParsedAskUserOption = {
  label: string;
  description?: string;
  code?: string;
  /** Display-ready price cell, e.g. "1,219 IDR" or "1219 印尼盾" */
  priceDisplay?: string;
  note?: string;
};

const CODE_PATTERN = /编码[：:\s]*(\d+)/g;

const PRICE_PATTERNS: Array<{ re: RegExp; format: (value: string, match: RegExpMatchArray) => string }> = [
  {
    re: /B\s*档\s*([\d,]+)\s*(?:IDR|印尼盾)?/i,
    format: (value) => `${value} IDR`,
  },
  {
    re: /单价[：:\s]*([\d,]+)\s*(?:印尼盾|IDR|Rp\.?)/i,
    format: (value, match) => {
      const tail = match[0].match(/(?:印尼盾|IDR|Rp\.?)/i)?.[0] ?? '印尼盾';
      return tail.toUpperCase() === 'IDR' ? `${value} IDR` : `${value} ${tail}`;
    },
  },
  {
    re: /([\d,]+)\s*印尼盾/,
    format: (value) => `${value} 印尼盾`,
  },
  {
    re: /([\d,]+)\s*IDR/i,
    format: (value) => `${value} IDR`,
  },
];

function extractPrice(description: string): { priceDisplay?: string; matchedText?: string } {
  for (const { re, format } of PRICE_PATTERNS) {
    const match = description.match(re);
    if (match?.[1]) {
      return {
        priceDisplay: format(match[1], match),
        matchedText: match[0],
      };
    }
  }
  return {};
}

function extractCode(description: string): string | undefined {
  CODE_PATTERN.lastIndex = 0;
  return CODE_PATTERN.exec(description)?.[1];
}

/** Strip structured fields from description, leaving usage / notes. */
export function parseAskUserOptionDescription(description: string | undefined): ParsedAskUserOption['note'] {
  if (!description?.trim()) return undefined;
  let rest = description.trim();

  CODE_PATTERN.lastIndex = 0;
  rest = rest.replace(CODE_PATTERN, '');

  for (const { re } of PRICE_PATTERNS) {
    rest = rest.replace(re, '');
  }

  rest = rest
    .replace(/^[，,、；;\s]+|[，,、；;\s]+$/g, '')
    .replace(/^。+|。+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return rest.length > 0 ? rest : undefined;
}

export function parseAskUserOption(label: string, description?: string): ParsedAskUserOption {
  if (!description?.trim()) {
    return { label, description };
  }
  const code = extractCode(description);
  const { priceDisplay } = extractPrice(description);
  const note = parseAskUserOptionDescription(description);
  return { label, description, code, priceDisplay, note };
}

function descriptionLooksStructured(description: string): boolean {
  if (CODE_PATTERN.test(description)) return true;
  CODE_PATTERN.lastIndex = 0;
  return PRICE_PATTERNS.some(({ re }) => re.test(description));
}

/** True when most options look like structured rows (编码 / 单价 / B档). */
export function shouldRenderAskUserTable(options: readonly AcpAskUserQuestionOption[]): boolean {
  const candidates = options.filter((o) => o.label.trim().length > 0);
  if (candidates.length < 2) return false;
  const structured = candidates.filter((o) => descriptionLooksStructured(o.description ?? ''));
  return structured.length >= Math.ceil(candidates.length / 2);
}

export function hasStructuredPriceColumn(options: readonly AcpAskUserQuestionOption[]): boolean {
  return options.some((o) => {
    const d = o.description ?? '';
    return extractPrice(d).priceDisplay !== undefined;
  });
}
