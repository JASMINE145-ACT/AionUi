/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  decidePrecipitationProposal,
  recordPrecipitationFunnelEvent,
  schedulePrecipitation,
} from '@/common/config/ccbPrecipitation';
import {
  PRECIPITATION_IDLE_DEBOUNCE_MS,
  resolvePrecipitationSessionId,
} from '@/renderer/hooks/useSessionPrecipitationSchedule';

describe('WANd.LEARNING.FUNNEL.001 events + silent schedule', () => {
  const prev = process.env.CCB_WANDING_CONFIG_DIR;
  let tmp: string;
  let configDir: string;

  afterEach(() => {
    if (prev === undefined) delete process.env.CCB_WANDING_CONFIG_DIR;
    else process.env.CCB_WANDING_CONFIG_DIR = prev;
    if (tmp && fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
  });

  function setup() {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ccb-precip-'));
    configDir = path.join(tmp, 'CCB-Wanding', '.claude');
    process.env.CCB_WANDING_CONFIG_DIR = configDir;
    fs.mkdirSync(path.join(configDir, 'learning'), { recursive: true });
  }

  it('records schedule_skipped for missing_session_id', () => {
    setup();
    const result = schedulePrecipitation({
      sessionId: '',
      conversationId: 'conv-1',
      turnId: 'turn-1',
    });
    expect(result.ok).toBe(false);
    expect(result.detail).toBe('missing_session_id');
    const events = fs
      .readFileSync(path.join(configDir, 'learning', 'precipitation_events.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(events.at(-1).event).toBe('schedule_skipped');
    expect(events.at(-1).skippedReason).toBe('missing_session_id');
    expect(JSON.stringify(events.at(-1))).not.toMatch(/content|transcript/i);
  });

  it('rejects recording forbidden content fields', () => {
    setup();
    const rejected = recordPrecipitationFunnelEvent({
      event: 'armed',
      conversationId: 'c1',
      ...({ content: 'nope' } as object),
    } as Parameters<typeof recordPrecipitationFunnelEvent>[0]);
    expect(rejected.ok).toBe(false);
    expect(rejected.detail).toBe('event_redacted_or_invalid');
  });
});

describe('WANd.LEARNING.SESSION_BIND.001 resolve', () => {
  it('prefers acp_session_id over sessionKey', () => {
    expect(
      resolvePrecipitationSessionId({
        acp_session_id: ' sess-a ',
        sessionKey: 'sess-b',
      })
    ).toBe('sess-a');
  });

  it('falls back to sessionKey', () => {
    expect(resolvePrecipitationSessionId({ sessionKey: 'sess-b' })).toBe('sess-b');
  });

  it('returns empty when unbound', () => {
    expect(resolvePrecipitationSessionId({})).toBe('');
    expect(resolvePrecipitationSessionId(undefined)).toBe('');
  });
});

describe('WANd.LEARNING.IDLE.001 debounce constant', () => {
  it('idle fallback is 10min (TurnHarvest primary)', () => {
    expect(PRECIPITATION_IDLE_DEBOUNCE_MS).toBe(600_000);
  });
});

describe('WANd.LEARNING.PROMOTION.001 applied gate', () => {
  const prev = process.env.CCB_WANDING_CONFIG_DIR;
  let tmp: string;
  let configDir: string;

  afterEach(() => {
    if (prev === undefined) delete process.env.CCB_WANDING_CONFIG_DIR;
    else process.env.CCB_WANDING_CONFIG_DIR = prev;
    if (tmp && fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
  });

  function seedPending() {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ccb-promo-'));
    configDir = path.join(tmp, 'CCB-Wanding', '.claude');
    process.env.CCB_WANDING_CONFIG_DIR = configDir;
    const learning = path.join(configDir, 'learning');
    fs.mkdirSync(learning, { recursive: true });
    fs.writeFileSync(
      path.join(learning, 'precipitation_pending.jsonl'),
      `${JSON.stringify({
        id: 'p1',
        status: 'pending',
        lane: 'business_rule',
        title: 't',
        content: 'rule body must stay inbox',
        evidence: [],
        sessionId: 's1',
        conversationId: 'c1',
        agentId: 'a',
        confidence: 0.9,
        metadata: {},
        createdAt: new Date().toISOString(),
      })}\n`,
      'utf8'
    );
  }

  it('deny does not call promoteBusinessRule', () => {
    seedPending();
    const spy = vi.fn(() => ({ ok: true }));
    const result = decidePrecipitationProposal(
      { proposalId: 'p1', action: 'deny' },
      { promoteBusinessRule: spy }
    );
    expect(result.ok).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('approve business_rule calls promote once', () => {
    seedPending();
    const spy = vi.fn(() => ({ ok: true }));
    const result = decidePrecipitationProposal(
      { proposalId: 'p1', action: 'approve' },
      { promoteBusinessRule: spy }
    );
    expect(result.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('approve stays pending when promote reports not applied', () => {
    seedPending();
    const spy = vi.fn(() => ({ ok: false, error: 'org_promote_not_applied' }));
    const result = decidePrecipitationProposal(
      { proposalId: 'p1', action: 'approve' },
      { promoteBusinessRule: spy }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe('org_promote_not_applied');
    const resolved = fs.existsSync(path.join(configDir, 'learning', 'precipitation_resolved.jsonl'));
    expect(resolved).toBe(false);
  });
});
