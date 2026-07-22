/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type PrecipitationLane =
  | 'business_rule'
  | 'personal_habit'
  | 'golden_path'
  | 'eval_case'
  | 'unknown';

export type PrecipitationProposalStatus = 'pending' | 'approve' | 'deny' | 'approve_edited';

export type PrecipitationProposal = {
  id: string;
  status: PrecipitationProposalStatus | 'pending';
  lane: PrecipitationLane;
  title: string;
  content: string;
  evidence: string[];
  sessionId: string;
  conversationId: string;
  agentId: string;
  confidence: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  resolvedAt?: string;
};

export type PrecipitationSummary = {
  status: 'idle' | 'running' | 'done' | 'error' | 'skipped';
  pendingCount: number;
  updatedAt: string | null;
  sessionId: string;
  conversationId: string;
  error: string | null;
  skippedReason: string | null;
  lastRunAt: string | null;
  /** Last funnel event name (desensitized). */
  lastEvent?: string | null;
  /** Last schedule/worker detail code (desensitized). */
  lastWorkerDetail?: string | null;
};

export type PrecipitationFunnelEventInput = {
  event: string;
  conversationId?: string;
  sessionId?: string;
  runId?: string;
  skippedReason?: string;
  workerDetail?: string;
  durationMs?: number;
  status?: string;
  pendingCount?: number;
};

export type PrecipitationDecisionInput = {
  proposalId: string;
  action: 'approve' | 'deny' | 'approve_edited';
  editedContent?: string;
  reviewNotes?: string;
};

export type PrecipitationDecisionResult = {
  ok: boolean;
  error?: string;
};

export type PrecipitationScheduleInput = {
  sessionId: string;
  conversationId: string;
  turnId?: string;
  agentId?: string;
  /** Skip nudge gate (idle fallback / explicit force). */
  force?: boolean;
  /** When true, do not bump nudge counter again (already checkpointed). */
  skipCheckpoint?: boolean;
};
