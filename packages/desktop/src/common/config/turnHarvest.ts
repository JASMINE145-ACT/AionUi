/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * TurnHarvest obligation + watermark + lease (Hermes-split port).
 * // Hermes: docs/reference/hermes-agent/agent/turn_finalizer.py sync vs review
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type TurnHarvestState = 'queued' | 'running' | 'done' | 'error';

export type TurnHarvestOutcomeKind =
  | 'proposals'
  | 'no_proposals'
  | 'retryable_error'
  | 'permanent_skip';

export type TurnHarvestObligation = {
  sessionId: string;
  conversationId: string;
  state: TurnHarvestState;
  latestTurnId: string;
  lastProcessedTurnId: string;
  reviewThroughTurnId: string;
  turnsSinceFullReview: number;
  attempt: number;
  leaseId: string;
  leaseOwner: string;
  leaseExpiresAt: string;
  lastError: string | null;
  updatedAt: string;
  /** ISO timestamp of last checkpoint bump (coalesce window). */
  lastCheckpointAt?: string;
};

export type TurnHarvestRunOutcome = {
  runId: string;
  sessionId: string;
  conversationId?: string;
  leaseId: string;
  reviewThroughTurnId: string;
  outcome: TurnHarvestOutcomeKind;
  proposalCount?: number;
  retryable?: boolean;
  errorCode?: string | null;
};

export const TURN_HARVEST_NUDGE_DEFAULT = 5;
export const TURN_HARVEST_LEASE_TTL_MS = 15 * 60 * 1000;
export const TURN_HARVEST_CHECKPOINT_COALESCE_MS = 1000;

function obligationsPath(configDir: string): string {
  return path.join(configDir, 'learning', 'turn_harvest_obligations.json');
}

function isoNow(): string {
  return new Date().toISOString();
}

function emptyObligation(sessionId: string, conversationId = ''): TurnHarvestObligation {
  return {
    sessionId,
    conversationId,
    state: 'queued',
    latestTurnId: '',
    lastProcessedTurnId: '',
    reviewThroughTurnId: '',
    turnsSinceFullReview: 0,
    attempt: 0,
    leaseId: '',
    leaseOwner: '',
    leaseExpiresAt: '',
    lastError: null,
    updatedAt: isoNow(),
  };
}

export function loadObligations(configDir: string): Record<string, TurnHarvestObligation> {
  const filePath = obligationsPath(configDir);
  if (!fs.existsSync(filePath)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    if (!data || typeof data !== 'object') return {};
    return data as Record<string, TurnHarvestObligation>;
  } catch {
    return {};
  }
}

export function saveObligations(
  configDir: string,
  map: Record<string, TurnHarvestObligation>
): void {
  const filePath = obligationsPath(configDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, filePath);
}

/** Checkpoint: update latestTurnId, bump nudge counter. No LLM.
 * Within coalesce window (1s), only refresh latestTurnId — do not double-count nudge.
 */
export function checkpointTurn(
  map: Record<string, TurnHarvestObligation>,
  input: {
    sessionId: string;
    conversationId: string;
    turnId: string;
    interrupted?: boolean;
    failed?: boolean;
    hasFinalResponse?: boolean;
    nowMs?: number;
  }
): { map: Record<string, TurnHarvestObligation>; shouldFullReview: boolean; obligation: TurnHarvestObligation } {
  if (input.interrupted || input.failed || input.hasFinalResponse === false) {
    const existing = map[input.sessionId] ?? emptyObligation(input.sessionId, input.conversationId);
    return { map, shouldFullReview: false, obligation: existing };
  }

  const now = input.nowMs ?? Date.now();
  const prev = map[input.sessionId] ?? emptyObligation(input.sessionId, input.conversationId);
  const lastAt = prev.lastCheckpointAt ? Date.parse(prev.lastCheckpointAt) : 0;
  // Coalesce duplicate checkpoints for the same turn within 1s (not distinct turns).
  const withinCoalesce =
    lastAt > 0 &&
    now - lastAt < TURN_HARVEST_CHECKPOINT_COALESCE_MS &&
    prev.latestTurnId === input.turnId;

  const next: TurnHarvestObligation = {
    ...prev,
    conversationId: input.conversationId || prev.conversationId,
    latestTurnId: input.turnId,
    turnsSinceFullReview: withinCoalesce
      ? prev.turnsSinceFullReview
      : prev.turnsSinceFullReview + 1,
    state: prev.state === 'running' ? 'running' : 'queued',
    lastCheckpointAt: new Date(now).toISOString(),
    updatedAt: isoNow(),
  };
  const shouldFullReview =
    next.state !== 'running' && next.turnsSinceFullReview >= TURN_HARVEST_NUDGE_DEFAULT;
  const out = { ...map, [input.sessionId]: next };
  return { map: out, shouldFullReview, obligation: next };
}

/** Reclaim leases whose TTL expired without an accepted outcome. */
export function reclaimExpiredLeases(
  map: Record<string, TurnHarvestObligation>,
  nowMs: number = Date.now()
): { map: Record<string, TurnHarvestObligation>; reclaimed: string[] } {
  const out: Record<string, TurnHarvestObligation> = {};
  const reclaimed: string[] = [];
  for (const [id, ob] of Object.entries(map)) {
    if (
      ob.state === 'running' &&
      ob.leaseExpiresAt &&
      Date.parse(ob.leaseExpiresAt) < nowMs
    ) {
      reclaimed.push(id);
      out[id] = {
        ...ob,
        state: 'queued',
        leaseId: '',
        leaseOwner: '',
        leaseExpiresAt: '',
        lastError: 'lease_expired',
        updatedAt: isoNow(),
      };
    } else {
      out[id] = ob;
    }
  }
  return { map: out, reclaimed };
}

/** Acquire FullReview: freeze reviewThroughTurnId + mint lease.
 * Always returns the post-reclaim map so callers can persist side effects even on failure.
 */
export function acquireFullReview(
  map: Record<string, TurnHarvestObligation>,
  sessionId: string,
  opts: { owner: string; nowMs?: number; ttlMs?: number } = { owner: 'aionui' }
): {
  map: Record<string, TurnHarvestObligation>;
  obligation: TurnHarvestObligation | null;
  leaseId: string | null;
} {
  const now = opts.nowMs ?? Date.now();
  const reclaimed = reclaimExpiredLeases(map, now);
  const work = reclaimed.map;
  const prev = work[sessionId];
  if (!prev || !prev.latestTurnId || prev.state === 'running') {
    return { map: work, obligation: null, leaseId: null };
  }

  const ttl = opts.ttlMs ?? TURN_HARVEST_LEASE_TTL_MS;
  const leaseId = crypto.randomUUID();
  const next: TurnHarvestObligation = {
    ...prev,
    state: 'running',
    reviewThroughTurnId: prev.latestTurnId,
    leaseId,
    leaseOwner: opts.owner,
    leaseExpiresAt: new Date(now + ttl).toISOString(),
    attempt: prev.attempt + 1,
    lastError: null,
    updatedAt: isoNow(),
  };
  return { map: { ...work, [sessionId]: next }, obligation: next, leaseId };
}

/** Apply worker outcome; watermark = reviewThrough only; re-queue if latest advanced. */
export function applyRunOutcome(
  map: Record<string, TurnHarvestObligation>,
  outcome: TurnHarvestRunOutcome,
  opts: { nowMs?: number } = {}
): {
  map: Record<string, TurnHarvestObligation>;
  accepted: boolean;
  reason?: string;
} {
  const prev = map[outcome.sessionId];
  if (!prev) return { map, accepted: false, reason: 'no_obligation' };

  if (!outcome.leaseId || outcome.leaseId !== prev.leaseId) {
    return { map, accepted: false, reason: 'stale_lease' };
  }

  const now = opts.nowMs ?? Date.now();
  if (prev.leaseExpiresAt && Date.parse(prev.leaseExpiresAt) < now) {
    return { map, accepted: false, reason: 'lease_expired' };
  }

  const reviewed = outcome.reviewThroughTurnId || prev.reviewThroughTurnId;
  const success =
    outcome.outcome === 'proposals' || outcome.outcome === 'no_proposals';

  if (!success) {
    const next: TurnHarvestObligation = {
      ...prev,
      state: outcome.outcome === 'permanent_skip' ? 'done' : 'error',
      leaseId: '',
      leaseOwner: '',
      leaseExpiresAt: '',
      lastError: outcome.errorCode || outcome.outcome,
      updatedAt: isoNow(),
    };
    return { map: { ...map, [outcome.sessionId]: next }, accepted: true };
  }

  const latest = prev.latestTurnId;
  const needsMore = Boolean(latest && reviewed && latest !== reviewed);
  const next: TurnHarvestObligation = {
    ...prev,
    lastProcessedTurnId: reviewed,
    state: needsMore ? 'queued' : 'done',
    turnsSinceFullReview: 0,
    leaseId: '',
    leaseOwner: '',
    leaseExpiresAt: '',
    lastError: null,
    attempt: 0,
    updatedAt: isoNow(),
  };
  return { map: { ...map, [outcome.sessionId]: next }, accepted: true };
}

/** App restart: invalidate running leases → queued. */
export function recoverObligationsOnRestart(
  map: Record<string, TurnHarvestObligation>
): Record<string, TurnHarvestObligation> {
  const out: Record<string, TurnHarvestObligation> = {};
  for (const [id, ob] of Object.entries(map)) {
    if (ob.state === 'running') {
      out[id] = {
        ...ob,
        state: 'queued',
        leaseId: '',
        leaseOwner: '',
        leaseExpiresAt: '',
        updatedAt: isoNow(),
      };
    } else {
      out[id] = ob;
    }
  }
  return out;
}

export function readOutcomeFile(
  configDir: string,
  runId: string
): TurnHarvestRunOutcome | null {
  const safe = runId.replace(/[^a-zA-Z0-9-_]/g, '_') || 'unknown';
  const filePath = path.join(configDir, 'learning', 'precipitation_runs', `${safe}.outcome.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as TurnHarvestRunOutcome;
    if (!data?.runId || !data?.sessionId || !data?.outcome) return null;
    return data;
  } catch {
    return null;
  }
}
