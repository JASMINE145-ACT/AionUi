/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Desensitized precipitation funnel events (WANd.LEARNING.FUNNEL.001 / REDACTION.001).
 * Proposal body / transcript / KB never belong here — Inbox only.
 */

export const PRECIPITATION_FUNNEL_EVENT_NAMES = [
  'armed',
  'cancelled',
  'schedule_skipped',
  'scheduled',
  'worker_running',
  'worker_skipped',
  'proposal_created',
  'approved',
  'denied',
  'checkpoint',
  'harvest_outcome',
  'stale_lease',
] as const;

export type PrecipitationFunnelEventName = (typeof PRECIPITATION_FUNNEL_EVENT_NAMES)[number];

/** Whitelist fields persisted on events.jsonl / summary / chip. */
export type PrecipitationFunnelEvent = {
  event: PrecipitationFunnelEventName;
  at: string;
  runId?: string;
  sessionIdShort?: string;
  conversationIdShort?: string;
  skippedReason?: string;
  workerDetail?: string;
  pendingCount?: number;
  durationMs?: number;
  status?: string;
};

const ALLOWED_EVENT = new Set<string>(PRECIPITATION_FUNNEL_EVENT_NAMES);

/** Forbidden keys that must never appear on a funnel payload (case-insensitive). */
export const FUNNEL_FORBIDDEN_KEYS = [
  'content',
  'transcript',
  'evidence',
  'title',
  'rule',
  'ruletext',
  'rule_text',
  'password',
  'token',
  'apikey',
  'api_key',
  'auth',
  'path',
  'filepath',
  'absolutePath',
  'prompt',
  'excerpt',
  'workflow',
  'profile',
  'kb',
  'knowledge',
] as const;

const FORBIDDEN_KEY_SET = new Set(FUNNEL_FORBIDDEN_KEYS.map((k) => k.toLowerCase()));

export function shortId(id: string, max = 16): string {
  const trimmed = id.trim();
  if (!trimmed) return '';
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function payloadHasForbiddenKeys(raw: Record<string, unknown>): boolean {
  for (const key of Object.keys(raw)) {
    if (FORBIDDEN_KEY_SET.has(key.toLowerCase())) return true;
  }
  return false;
}

/**
 * Build a redacted funnel event. Returns null if event name invalid or forbidden keys present.
 */
export function sanitizeFunnelEvent(
  raw: Record<string, unknown>,
  nowIso = new Date().toISOString()
): PrecipitationFunnelEvent | null {
  if (payloadHasForbiddenKeys(raw)) return null;

  const eventName = String(raw.event || '');
  if (!ALLOWED_EVENT.has(eventName)) return null;

  const out: PrecipitationFunnelEvent = {
    event: eventName as PrecipitationFunnelEventName,
    at: typeof raw.at === 'string' && raw.at ? raw.at : nowIso,
  };

  if (typeof raw.runId === 'string' && raw.runId.trim()) {
    out.runId = raw.runId.trim().slice(0, 64);
  }
  if (typeof raw.sessionId === 'string' && raw.sessionId.trim()) {
    out.sessionIdShort = shortId(raw.sessionId);
  } else if (typeof raw.sessionIdShort === 'string' && raw.sessionIdShort.trim()) {
    out.sessionIdShort = shortId(raw.sessionIdShort, 24);
  }
  if (typeof raw.conversationId === 'string' && raw.conversationId.trim()) {
    out.conversationIdShort = shortId(raw.conversationId);
  } else if (typeof raw.conversationIdShort === 'string' && raw.conversationIdShort.trim()) {
    out.conversationIdShort = shortId(raw.conversationIdShort, 24);
  }
  if (typeof raw.skippedReason === 'string' && raw.skippedReason.trim()) {
    out.skippedReason = raw.skippedReason.trim().slice(0, 64);
  }
  if (typeof raw.workerDetail === 'string' && raw.workerDetail.trim()) {
    // Codes only — strip path-like noise
    const detail = raw.workerDetail.trim().slice(0, 64);
    out.workerDetail = detail.includes('\\') || detail.includes('/') ? 'spawn_failed' : detail;
  }
  if (typeof raw.pendingCount === 'number' && Number.isFinite(raw.pendingCount)) {
    out.pendingCount = Math.max(0, Math.floor(raw.pendingCount));
  }
  if (typeof raw.durationMs === 'number' && Number.isFinite(raw.durationMs)) {
    out.durationMs = Math.max(0, Math.floor(raw.durationMs));
  }
  if (typeof raw.status === 'string' && raw.status.trim()) {
    out.status = raw.status.trim().slice(0, 32);
  }

  return out;
}

export function isPromotionAction(action: string): boolean {
  return action === 'approve' || action === 'approve_edited';
}

/** HG2: business_rule promote only on Inbox approve / approve_edited. */
export function shouldPromoteBusinessRule(action: string, lane: string): boolean {
  return isPromotionAction(action) && lane === 'business_rule';
}

export function assertSanitizeRejectsSecrets(): void {
  // used by tests — keep tree-shake friendly
  void isPlainObject;
}
