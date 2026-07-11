/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Session precipitation store + worker spawn (main process only).
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { resolveCcbClaudeConfigDir } from './ccbWandingRuntime';
import { resolveCcbInstallerRoot } from './ccbWandingRuntimeNode';
import { readMemoryFile, writeMemoryFile } from './ccbMemoryFiles';
import type {
  PrecipitationDecisionInput,
  PrecipitationDecisionResult,
  PrecipitationProposal,
  PrecipitationScheduleInput,
  PrecipitationSummary,
} from './ccbPrecipitationTypes';

const IDLE_SUMMARY: PrecipitationSummary = {
  status: 'idle',
  pendingCount: 0,
  updatedAt: null,
  sessionId: '',
  conversationId: '',
  error: null,
  skippedReason: null,
  lastRunAt: null,
};

function learningRoot(configDir: string): string {
  return path.join(configDir, 'learning');
}

function pendingPath(configDir: string): string {
  return path.join(learningRoot(configDir), 'precipitation_pending.jsonl');
}

function decisionsPath(configDir: string): string {
  return path.join(learningRoot(configDir), 'precipitation_decisions.jsonl');
}

function resolvedPath(configDir: string): string {
  return path.join(learningRoot(configDir), 'precipitation_resolved.jsonl');
}

function summaryPath(configDir: string): string {
  return path.join(learningRoot(configDir), '.precipitation-summary.json');
}

function businessRulePromotedPath(configDir: string): string {
  return path.join(learningRoot(configDir), 'business_rule_promoted.jsonl');
}

function goldenPathPromotedPath(configDir: string): string {
  return path.join(learningRoot(configDir), 'golden_path_promoted.jsonl');
}

function evalPromotedPath(configDir: string): string {
  return path.join(learningRoot(configDir), 'eval_precipitation_promoted.jsonl');
}

function businessKnowledgeShadowPath(configDir: string): string {
  return path.join(path.dirname(configDir), 'vendor', 'wanding', 'data', 'wanding_business_knowledge.md');
}

function resolveEvalCasesPath(): string | null {
  const installer = resolveCcbInstallerRoot();
  if (!installer) return null;
  const repoRoot = path.dirname(installer);
  const candidate = path.join(repoRoot, 'eval', 'agent_eval_cases.jsonl');
  return fs.existsSync(path.dirname(candidate)) ? candidate : null;
}

function readJsonl(filePath: string): Record<string, unknown>[] {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const rows: Record<string, unknown>[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed) as unknown;
      if (obj && typeof obj === 'object') rows.push(obj as Record<string, unknown>);
    } catch {
      // skip
    }
  }
  return rows;
}

function appendJsonl(filePath: string, obj: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(obj)}\n`, 'utf8');
}

type ResolvedRow = {
  proposalId: string;
  action: string;
  content?: string;
  resolvedAt: string;
};

function readResolvedRows(configDir: string): ResolvedRow[] {
  return readJsonl(resolvedPath(configDir)).map((row) => ({
    proposalId: String(row.proposalId || ''),
    action: String(row.action || ''),
    content: typeof row.content === 'string' ? row.content : undefined,
    resolvedAt: String(row.resolvedAt || ''),
  }));
}

function resolvedIdSet(configDir: string): Set<string> {
  return new Set(readResolvedRows(configDir).map((r) => r.proposalId).filter(Boolean));
}

function normalizeProposal(row: Record<string, unknown>): PrecipitationProposal {
  return {
    id: String(row.id || ''),
    status: (row.status as PrecipitationProposal['status']) || 'pending',
    lane: (row.lane as PrecipitationProposal['lane']) || 'unknown',
    title: String(row.title || ''),
    content: String(row.content || ''),
    evidence: Array.isArray(row.evidence) ? row.evidence.map(String) : [],
    sessionId: String(row.sessionId || ''),
    conversationId: String(row.conversationId || ''),
    agentId: String(row.agentId || ''),
    confidence: typeof row.confidence === 'number' ? row.confidence : 0,
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: String(row.createdAt || ''),
    resolvedAt: typeof row.resolvedAt === 'string' ? row.resolvedAt : undefined,
  };
}

export function resolvePrecipitationWorkerPath(): string | null {
  const installer = resolveCcbInstallerRoot();
  const candidates: string[] = [];
  if (installer) {
    candidates.push(
      path.join(
        installer,
        'config',
        'skills',
        'ccb-session-precipitation',
        'scripts',
        'precipitation_worker.py'
      )
    );
  }
  const configDir = resolveCcbClaudeConfigDir();
  if (configDir) {
    candidates.push(
      path.join(configDir, 'skills', 'ccb-session-precipitation', 'scripts', 'precipitation_worker.py')
    );
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveCcbProjectRoot(): string | null {
  const installer = resolveCcbInstallerRoot();
  if (!installer) return null;
  const parent = path.dirname(installer);
  return fs.existsSync(path.join(parent, 'python')) ? parent : null;
}

function resolvePromoteBusinessRuleScript(): string | null {
  const installer = resolveCcbInstallerRoot();
  const candidates: string[] = [];
  if (installer) {
    candidates.push(
      path.join(
        installer,
        'config',
        'skills',
        'ccb-session-precipitation',
        'scripts',
        'promote_business_rule.py'
      )
    );
  }
  const configDir = resolveCcbClaudeConfigDir();
  if (configDir) {
    candidates.push(
      path.join(configDir, 'skills', 'ccb-session-precipitation', 'scripts', 'promote_business_rule.py')
    );
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function resolvePythonExecutable(): string {
  return process.platform === 'win32' ? 'python' : 'python3';
}

export function listPrecipitationProposals(includeResolved = false): PrecipitationProposal[] {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir) return [];
  const resolved = includeResolved ? new Set<string>() : resolvedIdSet(configDir);
  const rows = readJsonl(pendingPath(configDir)).map(normalizeProposal);
  if (includeResolved) return rows.filter((r) => r.id);
  return rows.filter((r) => r.status === 'pending' && !resolved.has(r.id));
}

export function readPrecipitationSummary(): PrecipitationSummary {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir) return IDLE_SUMMARY;

  const filePath = summaryPath(configDir);
  let summary: PrecipitationSummary = {
    ...IDLE_SUMMARY,
    pendingCount: listPrecipitationProposals().length,
  };

  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
      summary = {
        status: (data.status as PrecipitationSummary['status']) || 'idle',
        pendingCount:
          typeof data.pendingCount === 'number' ? data.pendingCount : listPrecipitationProposals().length,
        updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
        sessionId: String(data.sessionId || ''),
        conversationId: String(data.conversationId || ''),
        error: typeof data.error === 'string' ? data.error : null,
        skippedReason: typeof data.skippedReason === 'string' ? data.skippedReason : null,
        lastRunAt: typeof data.lastRunAt === 'string' ? data.lastRunAt : null,
      };
    } catch {
      // keep defaults
    }
  } else {
    summary.pendingCount = listPrecipitationProposals().length;
  }
  return summary;
}

export function schedulePrecipitation(input: PrecipitationScheduleInput): { ok: boolean; detail?: string } {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir) return { ok: false, detail: 'ccb_config_missing' };

  const worker = resolvePrecipitationWorkerPath();
  if (!worker) return { ok: false, detail: 'worker_not_found' };

  const args = [
    worker,
    '--config-dir',
    configDir,
    '--session-id',
    input.sessionId,
    '--conversation-id',
    input.conversationId,
  ];
  if (input.turnId) {
    args.push('--run-id', input.turnId);
  }
  if (input.agentId) {
    args.push('--agent-id', input.agentId);
  }

  try {
    const child = spawn(resolvePythonExecutable(), args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'spawn_failed' };
  }
}

function applyApprovedPersonalHabit(content: string, target: 'workflow' | 'profile' = 'workflow'): void {
  const relPath = target === 'profile' ? 'personal/profile.md' : 'personal/workflow.md';
  const existing = readMemoryFile(relPath);
  const prior = existing?.content ?? '';
  const bullet = content.trim().startsWith('-') ? content.trim() : `- ${content.trim()}`;
  const next = prior.trim() ? `${prior.trimEnd()}\n${bullet}\n` : `${bullet}\n`;
  writeMemoryFile(relPath, next);
}

function normalizeEvalInput(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

function evalInputExists(filePath: string, input: string): boolean {
  const norm = normalizeEvalInput(input);
  if (!norm) return false;
  for (const row of readJsonl(filePath)) {
    if (normalizeEvalInput(String(row.input || '')) === norm) {
      return true;
    }
  }
  return false;
}

function applyApprovedBusinessRule(
  configDir: string,
  content: string,
  proposal: PrecipitationProposal,
  now: string,
  reviewNotes?: string
): { ok: boolean; error?: string } {
  const script = resolvePromoteBusinessRuleScript();
  if (!script) {
    return { ok: false, error: 'promote_script_missing' };
  }

  const projectRoot = resolveCcbProjectRoot();
  const env = { ...process.env } as NodeJS.ProcessEnv;
  if (projectRoot) {
    env.CCB_PROJECT_ROOT = projectRoot;
  }

  const shadow = businessKnowledgeShadowPath(configDir);
  const args = [
    script,
    '--rule-text',
    content,
    '--reason',
    (reviewNotes?.trim() || 'precipitation inbox approve').slice(0, 200),
  ];
  if (fs.existsSync(path.dirname(shadow))) {
    args.push('--sync-shadow', shadow);
  }

  const result = spawnSync(resolvePythonExecutable(), args, {
    encoding: 'utf8',
    env,
    timeout: 60_000,
  });

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    return { ok: false, error: detail || 'org_promote_failed' };
  }

  try {
    const parsed = JSON.parse((result.stdout || '').trim()) as {
      ok?: boolean;
      error?: string;
      skipped?: boolean;
    };
    if (parsed.ok !== true) {
      if (parsed.error === 'org_api_not_configured') {
        return { ok: false, error: 'org_login_required' };
      }
      return { ok: false, error: parsed.error || 'org_promote_failed' };
    }
    appendJsonl(businessRulePromotedPath(configDir), {
      proposalId: proposal.id,
      content,
      sessionId: proposal.sessionId,
      conversationId: proposal.conversationId,
      skipped: parsed.skipped === true,
      at: now,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'org_promote_invalid_response' };
  }
}

function applyApprovedGoldenPath(configDir: string, content: string, proposal: PrecipitationProposal, now: string): void {
  const meta = proposal.metadata;
  appendJsonl(goldenPathPromotedPath(configDir), {
    proposalId: proposal.id,
    description: content,
    toolSequence: meta.toolSequence ?? [],
    sessionId: proposal.sessionId,
    conversationId: proposal.conversationId,
    at: now,
  });
}

function applyApprovedEvalCase(configDir: string, content: string, proposal: PrecipitationProposal, now: string): void {
  const meta = proposal.metadata;
  const row = {
    id: `precip-${proposal.id}`,
    category: String(meta.category || 'routing'),
    agent: String(meta.agent || proposal.agentId || ''),
    input: content,
    expected_tools: Array.isArray(meta.expectedTools) ? meta.expectedTools : [],
    must_not: Array.isArray(meta.mustNot) ? meta.mustNot : [],
    evidence_session: proposal.sessionId,
    status: 'approved',
    promoted_at: now,
  };
  appendJsonl(evalPromotedPath(configDir), { ...row, proposalId: proposal.id });
  const evalCases = resolveEvalCasesPath();
  if (evalCases && !evalInputExists(evalCases, content)) {
    appendJsonl(evalCases, row);
  }
}

export function decidePrecipitationProposal(input: PrecipitationDecisionInput): PrecipitationDecisionResult {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir) return { ok: false, error: 'ccb_config_missing' };

  const resolved = resolvedIdSet(configDir);
  if (resolved.has(input.proposalId)) return { ok: false, error: 'already_resolved' };

  const rows = readJsonl(pendingPath(configDir));
  let found: PrecipitationProposal | null = null;
  for (const row of rows) {
    const proposal = normalizeProposal(row);
    if (proposal.id === input.proposalId && proposal.status === 'pending') {
      found = proposal;
      break;
    }
  }

  if (!found) return { ok: false, error: 'proposal_not_found' };

  const now = new Date().toISOString();
  const finalContent =
    input.action === 'approve_edited' && input.editedContent
      ? input.editedContent
      : found.content;

  if (input.action === 'deny') {
    appendJsonl(resolvedPath(configDir), {
      proposalId: input.proposalId,
      action: input.action,
      content: finalContent,
      resolvedAt: now,
    });
    appendJsonl(decisionsPath(configDir), {
      proposalId: input.proposalId,
      action: input.action,
      lane: found.lane,
      editedContent: input.editedContent ?? null,
      reviewNotes: input.reviewNotes ?? null,
      at: now,
    });
    return { ok: true };
  }

  if (found.lane === 'personal_habit') {
    const target =
      found.metadata?.target === 'profile' ? 'profile' : ('workflow' as 'workflow' | 'profile');
    applyApprovedPersonalHabit(finalContent, target);
  } else if (found.lane === 'business_rule') {
    const promoted = applyApprovedBusinessRule(configDir, finalContent, found, now, input.reviewNotes);
    if (!promoted.ok) {
      return { ok: false, error: promoted.error || 'org_promote_failed' };
    }
  } else if (found.lane === 'golden_path') {
    applyApprovedGoldenPath(configDir, finalContent, found, now);
  } else if (found.lane === 'eval_case') {
    applyApprovedEvalCase(configDir, finalContent, found, now);
  }

  appendJsonl(resolvedPath(configDir), {
    proposalId: input.proposalId,
    action: input.action,
    content: finalContent,
    resolvedAt: now,
  });
  appendJsonl(decisionsPath(configDir), {
    proposalId: input.proposalId,
    action: input.action,
    lane: found.lane,
    editedContent: input.editedContent ?? null,
    reviewNotes: input.reviewNotes ?? null,
    at: now,
  });

  const summaryFile = summaryPath(configDir);
  const summary = readPrecipitationSummary();
  fs.writeFileSync(
    summaryFile,
    JSON.stringify(
      {
        ...summary,
        status: 'done',
        pendingCount: listPrecipitationProposals().length,
        updatedAt: now,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  return { ok: true };
}
