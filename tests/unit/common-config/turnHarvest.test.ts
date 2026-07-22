/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import {
  acquireFullReview,
  applyRunOutcome,
  checkpointTurn,
  reclaimExpiredLeases,
  recoverObligationsOnRestart,
  TURN_HARVEST_NUDGE_DEFAULT,
  type TurnHarvestObligation,
} from '@/common/config/turnHarvest';

function baseMap(): Record<string, TurnHarvestObligation> {
  return {};
}

describe('turnHarvest watermark + lease', () => {
  it('checkpoints without full review until nudge N', () => {
    let map = baseMap();
    for (let i = 1; i < TURN_HARVEST_NUDGE_DEFAULT; i++) {
      const r = checkpointTurn(map, {
        sessionId: 's1',
        conversationId: 'c1',
        turnId: `t${i}`,
        hasFinalResponse: true,
      });
      map = r.map;
      expect(r.shouldFullReview).toBe(false);
    }
    const last = checkpointTurn(map, {
      sessionId: 's1',
      conversationId: 'c1',
      turnId: 't5',
      hasFinalResponse: true,
    });
    expect(last.shouldFullReview).toBe(true);
    expect(last.obligation.latestTurnId).toBe('t5');
    expect(last.obligation.turnsSinceFullReview).toBe(5);
  });

  it('skips checkpoint when interrupted', () => {
    const r = checkpointTurn(baseMap(), {
      sessionId: 's1',
      conversationId: 'c1',
      turnId: 't1',
      interrupted: true,
      hasFinalResponse: true,
    });
    expect(r.obligation.latestTurnId).toBe('');
    expect(r.shouldFullReview).toBe(false);
  });

  it('freezes reviewThrough and re-queues when latest advances during review', () => {
    let map = baseMap();
    for (let i = 1; i <= 5; i++) {
      map = checkpointTurn(map, {
        sessionId: 's1',
        conversationId: 'c1',
        turnId: `t${i}`,
        hasFinalResponse: true,
      }).map;
    }
    const acquired = acquireFullReview(map, 's1', { owner: 'test' });
    expect(acquired.obligation).not.toBeNull();
    map = acquired.map;
    expect(map.s1.reviewThroughTurnId).toBe('t5');
    expect(map.s1.state).toBe('running');

    // Newer turn while running
    map = checkpointTurn(map, {
      sessionId: 's1',
      conversationId: 'c1',
      turnId: 't6',
      hasFinalResponse: true,
    }).map;
    expect(map.s1.latestTurnId).toBe('t6');

    const applied = applyRunOutcome(map, {
      runId: 't5',
      sessionId: 's1',
      leaseId: acquired.leaseId!,
      reviewThroughTurnId: 't5',
      outcome: 'no_proposals',
    });
    expect(applied.accepted).toBe(true);
    expect(applied.map.s1.lastProcessedTurnId).toBe('t5');
    expect(applied.map.s1.state).toBe('queued');
    expect(applied.map.s1.turnsSinceFullReview).toBe(0);
  });

  it('rejects stale lease', () => {
    let map = baseMap();
    map = checkpointTurn(map, {
      sessionId: 's1',
      conversationId: 'c1',
      turnId: 't1',
      hasFinalResponse: true,
    }).map;
    // Force nudge
    map.s1.turnsSinceFullReview = 5;
    const acquired = acquireFullReview(map, 's1', { owner: 'test' });
    map = acquired.map;
    const rejected = applyRunOutcome(map, {
      runId: 't1',
      sessionId: 's1',
      leaseId: 'wrong-lease',
      reviewThroughTurnId: 't1',
      outcome: 'proposals',
      proposalCount: 1,
    });
    expect(rejected.accepted).toBe(false);
    expect(rejected.reason).toBe('stale_lease');
    expect(map.s1.state).toBe('running');
  });

  it('restart invalidates running lease', () => {
    let map = baseMap();
    map = checkpointTurn(map, {
      sessionId: 's1',
      conversationId: 'c1',
      turnId: 't1',
      hasFinalResponse: true,
    }).map;
    map.s1.turnsSinceFullReview = 5;
    const acquired = acquireFullReview(map, 's1', { owner: 'test' });
    map = acquired.map;
    map = recoverObligationsOnRestart(map);
    expect(map.s1.state).toBe('queued');
    expect(map.s1.leaseId).toBe('');
  });

  it('coalesces duplicate checkpoint for same turnId within 1s', () => {
    const t0 = 1_000_000;
    let map = checkpointTurn(baseMap(), {
      sessionId: 's1',
      conversationId: 'c1',
      turnId: 't1',
      hasFinalResponse: true,
      nowMs: t0,
    }).map;
    expect(map.s1.turnsSinceFullReview).toBe(1);
    map = checkpointTurn(map, {
      sessionId: 's1',
      conversationId: 'c1',
      turnId: 't1',
      hasFinalResponse: true,
      nowMs: t0 + 200,
    }).map;
    expect(map.s1.turnsSinceFullReview).toBe(1);
    map = checkpointTurn(map, {
      sessionId: 's1',
      conversationId: 'c1',
      turnId: 't2',
      hasFinalResponse: true,
      nowMs: t0 + 300,
    }).map;
    expect(map.s1.turnsSinceFullReview).toBe(2);
  });

  it('reclaims expired lease then allows acquire', () => {
    const t0 = 2_000_000;
    let map = checkpointTurn(baseMap(), {
      sessionId: 's1',
      conversationId: 'c1',
      turnId: 't1',
      hasFinalResponse: true,
      nowMs: t0,
    }).map;
    map.s1.turnsSinceFullReview = 5;
    const acquired = acquireFullReview(map, 's1', { owner: 'test', nowMs: t0, ttlMs: 1000 });
    expect(acquired.obligation).not.toBeNull();
    map = acquired.map;
    expect(map.s1.state).toBe('running');

    const blocked = acquireFullReview(map, 's1', { owner: 'test', nowMs: t0 + 500 });
    expect(blocked.obligation).toBeNull();
    // Failed acquire still returns map (no reclaim needed here — lease still valid)
    expect(blocked.map.s1.state).toBe('running');

    const { map: reclaimed, reclaimed: ids } = reclaimExpiredLeases(map, t0 + 2000);
    expect(ids).toEqual(['s1']);
    expect(reclaimed.s1.state).toBe('queued');

    const again = acquireFullReview(map, 's1', { owner: 'test', nowMs: t0 + 2000, ttlMs: 1000 });
    expect(again.obligation).not.toBeNull();
    expect(again.obligation!.state).toBe('running');
  });

  it('failed acquire still returns reclaim side effects for other sessions', () => {
    const t0 = 3_000_000;
    let map: Record<string, TurnHarvestObligation> = {};
    map = checkpointTurn(map, {
      sessionId: 'other',
      conversationId: 'c0',
      turnId: 'o1',
      hasFinalResponse: true,
      nowMs: t0,
    }).map;
    map.other.turnsSinceFullReview = 5;
    const otherAcq = acquireFullReview(map, 'other', { owner: 'test', nowMs: t0, ttlMs: 100 });
    map = otherAcq.map;

    map = checkpointTurn(map, {
      sessionId: 's1',
      conversationId: 'c1',
      turnId: 't1',
      hasFinalResponse: true,
      nowMs: t0,
    }).map;
    // s1 has no nudge / empty latest after we force running on s1 without lease... 
    // instead: s1 cannot acquire because it has no latestTurnId cleared — use running self
    map.s1.turnsSinceFullReview = 5;
    const s1Acq = acquireFullReview(map, 's1', { owner: 'test', nowMs: t0, ttlMs: 10_000 });
    map = s1Acq.map;
    expect(map.s1.state).toBe('running');

    // other lease expired; s1 still running → acquire s1 fails but other is reclaimed
    const fail = acquireFullReview(map, 's1', { owner: 'test', nowMs: t0 + 500 });
    expect(fail.obligation).toBeNull();
    expect(fail.map.other.state).toBe('queued');
    expect(fail.map.other.leaseId).toBe('');
    expect(fail.map.s1.state).toBe('running');
  });
});
