/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type AgentToolCallRawInput = Record<string, unknown> | string | undefined;

export function isAgentDelegationToolCall(rawInput: AgentToolCallRawInput, title?: string, kind?: string): boolean {
  if (kind === 'agent' || kind === 'think') {
    return true;
  }
  if (!rawInput || typeof rawInput !== 'object') {
    return false;
  }
  const input = rawInput as Record<string, unknown>;
  if (typeof input.subagent_type === 'string' && input.subagent_type.trim()) {
    return true;
  }
  if (typeof input.prompt === 'string' && (typeof input.description === 'string' || Boolean(title?.trim()))) {
    return true;
  }
  return false;
}

export function getAgentDelegationLabel(rawInput: AgentToolCallRawInput, title?: string): string {
  if (rawInput && typeof rawInput === 'object') {
    const input = rawInput as Record<string, unknown>;
    const subagentType = typeof input.subagent_type === 'string' ? input.subagent_type.trim() : '';
    if (subagentType) {
      return subagentType;
    }
    const description = typeof input.description === 'string' ? input.description.trim() : '';
    if (description) {
      return description;
    }
  }
  return title?.trim() || 'Subagent';
}

export function extractAgentDelegationPrompt(rawInput: AgentToolCallRawInput): string | undefined {
  if (!rawInput || typeof rawInput !== 'object') {
    return undefined;
  }
  const prompt = (rawInput as Record<string, unknown>).prompt;
  return typeof prompt === 'string' && prompt.trim() ? prompt.trim() : undefined;
}
