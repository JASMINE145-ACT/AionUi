/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readPersonalMemoryLearningStatus } from '@/common/config/ccbPersonalMemoryLearning';

describe('readPersonalMemoryLearningStatus', () => {
  const prev = process.env.CCB_WANDING_CONFIG_DIR;
  let tmp: string;

  afterEach(() => {
    if (prev === undefined) delete process.env.CCB_WANDING_CONFIG_DIR;
    else process.env.CCB_WANDING_CONFIG_DIR = prev;
    if (tmp && fs.existsSync(tmp)) {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('shows banner when status is learning and fresh', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ccb-learn-'));
    process.env.CCB_WANDING_CONFIG_DIR = path.join(tmp, 'CCB-Wanding', '.claude');
    const mem = path.join(process.env.CCB_WANDING_CONFIG_DIR, 'memory');
    fs.mkdirSync(mem, { recursive: true });
    fs.writeFileSync(
      path.join(mem, '.learning-status.json'),
      JSON.stringify({
        status: 'learning',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        sessionId: 's1',
        agentType: 'wande-orchestrator',
        entriesAppended: 0,
        error: null,
      }),
      'utf8'
    );

    const status = readPersonalMemoryLearningStatus();
    expect(status.showBanner).toBe(true);
    expect(status.status).toBe('learning');
  });

  it('hides banner when learning is stale', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ccb-learn-'));
    process.env.CCB_WANDING_CONFIG_DIR = path.join(tmp, 'CCB-Wanding', '.claude');
    const mem = path.join(process.env.CCB_WANDING_CONFIG_DIR, 'memory');
    fs.mkdirSync(mem, { recursive: true });
    const old = new Date(Date.now() - 120_000).toISOString();
    fs.writeFileSync(
      path.join(mem, '.learning-status.json'),
      JSON.stringify({
        status: 'learning',
        startedAt: old,
        finishedAt: null,
        sessionId: 's1',
        agentType: 'wande-orchestrator',
        entriesAppended: 0,
        error: null,
      }),
      'utf8'
    );

    const status = readPersonalMemoryLearningStatus();
    expect(status.showBanner).toBe(false);
  });
});
