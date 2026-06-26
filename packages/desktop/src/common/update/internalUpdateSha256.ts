/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';

export function isValidSha256Hex(value: string | undefined | null): boolean {
  const expected = (value ?? '').trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(expected);
}

export async function verifyFileSha256(filePath: string, expectedHex: string): Promise<boolean> {
  if (!isValidSha256Hex(expectedHex)) {
    return false;
  }
  const expected = expectedHex.trim().toLowerCase();

  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => {
      resolve(hash.digest('hex') === expected);
    });
  });
}
