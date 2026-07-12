/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Browser/renderer-safe CCB-Wanding runtime helpers (no node:fs).
 */

export type CcbWandingAgentLike = {
  id?: string;
  backend?: string;
  cli_path?: string;
  name?: string;
};

/** MCP server names owned by CCB-Wanding install — never overwrite during migration. */
export const CCB_RESERVED_MCP_NAMES = new Set([
  'quotation',
  'accurate',
  'excel-mcp',
  'excel',
  'office-word',
  'guide_mcp',
  'aionui-image-generation',
]);

/**
 * Resolve CCB-Wanding CLAUDE_CONFIG_DIR (same convention as route-b patch).
 * Does not verify settings.json exists — use main-process IPC for that.
 */
export function resolveCcbClaudeConfigDir(): string | null {
  const fromEnv = process.env.CCB_WANDING_CONFIG_DIR ?? process.env.CLAUDE_CONFIG_DIR;
  if (fromEnv && fromEnv.toLowerCase().includes('ccb-wanding')) {
    return fromEnv;
  }
  if (typeof process !== 'undefined' && process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return `${process.env.LOCALAPPDATA}\\CCB-Wanding\\.claude`;
  }
  return null;
}

/** ACP backend slug used for CCB-Wanding preset assistants in Guid / conversation create. */
export const CCB_PRESET_AGENT_BACKEND = 'claude' as const;

/**
 * When CCB-Wanding is the runtime authority, preset assistant cards must route
 * through the CCB Claude Code ACP slot — not legacy aionrs/gemini defaults.
 */
export function resolveCcbPresetAgentType(
  originalType: string | undefined,
  options: { ccbAuthorityActive: boolean; isPresetAssistant: boolean }
): string {
  if (!options.ccbAuthorityActive || !options.isPresetAssistant) {
    return originalType || 'gemini';
  }
  return CCB_PRESET_AGENT_BACKEND;
}

/** Strip legacy `builtin-` prefix before CCB profile lookup / storage. */
export function stripBuiltinAssistantIdPrefix(id: string): string {
  return id.replace(/^builtin-/, '');
}

export function isCcbWandingAgent(agent?: CcbWandingAgentLike | null): boolean {
  if (!agent) {
    return false;
  }
  const haystack = [agent.id, agent.backend, agent.cli_path, agent.name]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();
  return (
    haystack.includes('ccb-wanding') ||
    haystack.includes('ccb_wanding') ||
    haystack.includes('ccb-wanding-route-b')
  );
}

/**
 * Fleet default: hide WeCom developer-docs outbound link.
 * Dev machine only: set CCB_WANDING_WECOM_DEV_DOCS=1 (or true/yes) before launch.
 * Renderer reads preload-injected `__wecomDevDocs` (main env → sync IPC); not raw process.env.
 */
export function isWecomDevDocsLinkEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return Boolean((window as Window & { __wecomDevDocs?: boolean }).__wecomDevDocs);
  }
  try {
    if (typeof process === 'undefined') {
      return false;
    }
    const raw = (process.env.CCB_WANDING_WECOM_DEV_DOCS ?? '').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes';
  } catch {
    return false;
  }
}
