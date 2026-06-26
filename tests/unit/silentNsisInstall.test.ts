/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const quitMock = vi.fn();
const spawnMock = vi.fn(() => {
  const child = { unref: vi.fn() };
  return child;
});

vi.mock('electron', () => ({
  app: { quit: quitMock },
}));

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}));

describe('silentNsisInstall', () => {
  let tmpInstaller: string;

  beforeEach(() => {
    vi.useFakeTimers();
    quitMock.mockClear();
    spawnMock.mockClear();
    tmpInstaller = path.join(os.tmpdir(), `test-installer-${Date.now()}.exe`);
    fs.writeFileSync(tmpInstaller, 'fake', { flush: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(tmpInstaller, { force: true });
    quitMock.mockClear();
    spawnMock.mockClear();
  });

  it('spawns detached NSIS /S and schedules app quit', async () => {
    const { applySilentNsisInstall } = await import(
      '../../packages/desktop/src/process/bridge/silentNsisInstall'
    );

    applySilentNsisInstall(tmpInstaller, 500);

    expect(spawnMock).toHaveBeenCalledWith(
      tmpInstaller,
      ['/S'],
      expect.objectContaining({ detached: true, windowsHide: true })
    );

    vi.advanceTimersByTime(500);
    expect(quitMock).toHaveBeenCalledTimes(1);
  });

  it('throws when installer file is missing', async () => {
    const { applySilentNsisInstall } = await import(
      '../../packages/desktop/src/process/bridge/silentNsisInstall'
    );

    expect(() => applySilentNsisInstall(path.join(os.tmpdir(), 'missing-installer.exe'))).toThrow(
      /Installer not found/
    );
  });
});
