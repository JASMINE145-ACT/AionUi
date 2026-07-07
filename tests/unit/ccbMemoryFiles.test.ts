/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  listMemoryFiles,
  readMemoryFile,
  resolveMemoryRelPath,
  writeMemoryFile,
} from '@/common/config/ccbMemoryFiles';

describe('ccbMemoryFiles path jail', () => {
  const prev = process.env.CCB_WANDING_CONFIG_DIR;
  let tmp: string;
  let configDir: string;

  afterEach(() => {
    if (prev === undefined) delete process.env.CCB_WANDING_CONFIG_DIR;
    else process.env.CCB_WANDING_CONFIG_DIR = prev;
    if (tmp && fs.existsSync(tmp)) {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  function setupSeed() {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ccb-mem-'));
    configDir = path.join(tmp, 'CCB-Wanding', '.claude');
    process.env.CCB_WANDING_CONFIG_DIR = configDir;
    const personal = path.join(configDir, 'memory', 'personal');
    fs.mkdirSync(personal, { recursive: true });
    fs.writeFileSync(path.join(personal, 'workflow.md'), '# workflow\n', 'utf8');
    fs.writeFileSync(path.join(personal, 'profile.md'), '# profile\n', 'utf8');
  }

  it('rejects path traversal', () => {
    setupSeed();
    expect(resolveMemoryRelPath(configDir, '../settings.json')).toBeNull();
    expect(resolveMemoryRelPath(configDir, 'personal/../../settings.json')).toBeNull();
    expect(resolveMemoryRelPath(configDir, 'personal/foo.txt')).toBeNull();
  });

  it('lists personal files', () => {
    setupSeed();
    const files = listMemoryFiles('personal');
    expect(files.map((f) => f.name).sort()).toEqual(['profile.md', 'workflow.md']);
  });

  it('reads and writes jailed paths', () => {
    setupSeed();
    const read = readMemoryFile('personal/workflow.md');
    expect(read?.content).toContain('workflow');
    writeMemoryFile('personal/workflow.md', '- [2026-07-06] habit\n');
    expect(readMemoryFile('personal/workflow.md')?.content).toContain('habit');
  });

  it('returns empty business when missing', () => {
    setupSeed();
    expect(listMemoryFiles('business')).toEqual([]);
  });
});
