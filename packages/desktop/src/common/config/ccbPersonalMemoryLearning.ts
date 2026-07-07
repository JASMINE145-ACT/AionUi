/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Personal memory learning status (.learning-status.json) for Guid banner.
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolveCcbClaudeConfigDir } from './ccbWandingRuntime';

export type CcbPersonalMemoryLearningStatus = {
  status: 'idle' | 'learning' | 'done' | 'error';
  startedAt: string | null;
  finishedAt: string | null;
  sessionId: string;
  agentType: string;
  entriesAppended: number;
  error: string | null;
  /** True when UI should show the learning banner */
  showBanner: boolean;
};

const STALE_MS = 90_000;

const IDLE: CcbPersonalMemoryLearningStatus = {
  status: 'idle',
  startedAt: null,
  finishedAt: null,
  sessionId: '',
  agentType: '',
  entriesAppended: 0,
  error: null,
  showBanner: false,
};

function learningStatusPath(configDir: string): string {
  return path.join(configDir, 'memory', '.learning-status.json');
}

function isStale(startedAt: string | null): boolean {
  if (!startedAt) return true;
  const t = Date.parse(startedAt);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > STALE_MS;
}

/** Main-process only: read learning status for banner. */
export function readPersonalMemoryLearningStatus(): CcbPersonalMemoryLearningStatus {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir) return IDLE;

  const filePath = learningStatusPath(configDir);
  if (!fs.existsSync(filePath)) return IDLE;

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    const status = String(data.status || 'idle') as CcbPersonalMemoryLearningStatus['status'];
    const startedAt = typeof data.startedAt === 'string' ? data.startedAt : null;
    const finishedAt = typeof data.finishedAt === 'string' ? data.finishedAt : null;
    const learning = status === 'learning' && !isStale(startedAt);
    return {
      status: learning ? 'learning' : status === 'learning' ? 'idle' : status,
      startedAt,
      finishedAt,
      sessionId: String(data.sessionId || ''),
      agentType: String(data.agentType || ''),
      entriesAppended: typeof data.entriesAppended === 'number' ? data.entriesAppended : 0,
      error: typeof data.error === 'string' ? data.error : null,
      showBanner: learning,
    };
  } catch {
    return IDLE;
  }
}
