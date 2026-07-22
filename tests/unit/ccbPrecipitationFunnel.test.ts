/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import {
  FUNNEL_FORBIDDEN_KEYS,
  sanitizeFunnelEvent,
  shortId,
  shouldPromoteBusinessRule,
} from '@/common/config/ccbPrecipitationFunnel';

describe('WANd.LEARNING.REDACTION.001 / FUNNEL.001', () => {
  it('shortens long ids', () => {
    expect(shortId('abcdefghijklmnop')).toBe('abcdefghijklmnop');
    expect(shortId('abcdefghijklmnopqrstuvwxyz')).toMatch(/^abcdefgh…wxyz$/);
  });

  it('accepts whitelist schedule_skipped event', () => {
    const event = sanitizeFunnelEvent({
      event: 'schedule_skipped',
      sessionId: 'sess-real-acp-id-1234567890',
      conversationId: 'conv-abc',
      runId: 'turn-1',
      skippedReason: 'missing_session_id',
    });
    expect(event).not.toBeNull();
    expect(event?.event).toBe('schedule_skipped');
    expect(event?.skippedReason).toBe('missing_session_id');
    expect(event?.sessionIdShort).toBeTruthy();
    expect(JSON.stringify(event)).not.toContain('sess-real-acp-id-1234567890');
  });

  it('strips and rejects forbidden content keys', () => {
    for (const key of ['content', 'transcript', 'evidence', 'token', 'path']) {
      expect(
        sanitizeFunnelEvent({
          event: 'scheduled',
          [key]: 'secret-or-body',
        })
      ).toBeNull();
    }
    expect(FUNNEL_FORBIDDEN_KEYS.length).toBeGreaterThan(5);
  });

  it('keeps only allowed metadata fields', () => {
    const event = sanitizeFunnelEvent({
      event: 'scheduled',
      sessionId: 'abcdefghijklmnopqrstuvwxyz',
      conversationId: 'c1',
      runId: 't1',
      workerDetail: 'ok',
      pendingCount: 2,
      durationMs: 30_000,
      status: 'running',
    });
    expect(event).toEqual({
      event: 'scheduled',
      at: expect.any(String),
      runId: 't1',
      sessionIdShort: 'abcdefgh…wxyz',
      conversationIdShort: 'c1',
      workerDetail: 'ok',
      pendingCount: 2,
      durationMs: 30_000,
      status: 'running',
    });
    expect(JSON.stringify(event)).not.toMatch(/abcdefghi/);
  });

  it('maps path-like workerDetail to spawn_failed', () => {
    const event = sanitizeFunnelEvent({
      event: 'schedule_skipped',
      workerDetail: 'C:\\Users\\me\\worker.py ENOENT',
      skippedReason: 'spawn_failed',
    });
    expect(event?.workerDetail).toBe('spawn_failed');
  });
});

describe('WANd.LEARNING.PROMOTION.001 gate helper', () => {
  it('allows promote only for approve actions on business_rule', () => {
    expect(shouldPromoteBusinessRule('approve', 'business_rule')).toBe(true);
    expect(shouldPromoteBusinessRule('approve_edited', 'business_rule')).toBe(true);
    expect(shouldPromoteBusinessRule('deny', 'business_rule')).toBe(false);
    expect(shouldPromoteBusinessRule('approve', 'personal_habit')).toBe(false);
  });
});
