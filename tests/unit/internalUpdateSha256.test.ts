/**
 * @vitest-environment node
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { isValidSha256Hex, verifyFileSha256 } from '@/common/update/internalUpdateSha256';

describe('isValidSha256Hex', () => {
  it('accepts 64-char hex', () => {
    expect(isValidSha256Hex('a'.repeat(64))).toBe(true);
    expect(isValidSha256Hex('A'.repeat(64))).toBe(true);
  });

  it('rejects empty or invalid', () => {
    expect(isValidSha256Hex('')).toBe(false);
    expect(isValidSha256Hex('not-hex')).toBe(false);
    expect(isValidSha256Hex('a'.repeat(63))).toBe(false);
  });
});

describe('verifyFileSha256', () => {
  const files: string[] = [];

  afterEach(() => {
    for (const f of files) {
      fs.rmSync(f, { force: true });
    }
  });

  it('matches known hash', async () => {
    const file = path.join(os.tmpdir(), `sha-test-${Date.now()}.txt`);
    files.push(file);
    fs.writeFileSync(file, 'hello', 'utf-8');
    const expected = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
    expect(await verifyFileSha256(file, expected)).toBe(true);
  });

  it('rejects mismatch', async () => {
    const file = path.join(os.tmpdir(), `sha-test-bad-${Date.now()}.txt`);
    files.push(file);
    fs.writeFileSync(file, 'hello', 'utf-8');
    expect(await verifyFileSha256(file, 'b'.repeat(64))).toBe(false);
  });
});
