/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Browser/renderer-safe CCB config helpers (no node:fs).
 */

import type { IMcpServer } from '@/common/config/storage';
import { CCB_RESERVED_MCP_NAMES } from './ccbWandingRuntime';

export const CCB_RUNTIME_MIGRATION_FLAG = 'migration.ccbRuntimeConfigMigrated_v1' as const;

export type SettingsJson = {
  mcpServers?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

export type SkillRecord = {
  name: string;
  path?: string;
  source_path?: string;
  builtin?: boolean;
};

export type MigrationReport = {
  migrated_at: string;
  config_dir: string;
  backup_settings_path?: string;
  mcp_imported: string[];
  mcp_skipped_existing: string[];
  mcp_skipped_reserved: string[];
  skills_copied: string[];
  skills_skipped_existing: string[];
  skills_manual: string[];
  errors: string[];
};

export type CcbSessionRuntimeOverrides = {
  model?: string;
  skill_ids?: string[];
  disabled_builtin_skill_ids?: string[];
  mcp_ids?: string[];
  selected_mcp_server_ids?: string[];
  selected_session_mcp_servers?: unknown[];
};

export function normalizeMcpServerName(name: string): string {
  return name.trim().toLowerCase();
}

export function safeSkillDirectoryName(name: string): string | null {
  const safe = name
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\.+$/g, '')
    .trim();
  return safe.length > 0 ? safe : null;
}

export function mcpServerToSettingsEntry(server: IMcpServer): Record<string, unknown> | null {
  const transport = server.transport;
  if (!transport) {
    return null;
  }

  switch (transport.type) {
    case 'stdio':
      return {
        type: 'stdio',
        command: transport.command,
        ...(transport.args?.length ? { args: transport.args } : {}),
        ...(transport.env && Object.keys(transport.env).length ? { env: transport.env } : {}),
        ...(server.description ? { description: server.description } : {}),
      };
    case 'sse':
      return {
        type: 'sse',
        url: transport.url,
        ...(transport.headers && Object.keys(transport.headers).length ? { headers: transport.headers } : {}),
        ...(server.description ? { description: server.description } : {}),
      };
    case 'http':
    case 'streamable_http':
      return {
        type: transport.type === 'streamable_http' ? 'http' : transport.type,
        url: transport.url,
        ...(transport.headers && Object.keys(transport.headers).length ? { headers: transport.headers } : {}),
        ...(server.description ? { description: server.description } : {}),
      };
    default:
      return null;
  }
}

export function mergeMcpIntoCcbSettings(
  existing: SettingsJson,
  importableServers: readonly IMcpServer[]
): { settings: SettingsJson; imported: string[]; skippedExisting: string[]; skippedReserved: string[] } {
  const settings: SettingsJson = { ...existing, mcpServers: { ...(existing.mcpServers ?? {}) } };
  const existingNames = new Set(Object.keys(settings.mcpServers).map(normalizeMcpServerName));
  const imported: string[] = [];
  const skippedExisting: string[] = [];
  const skippedReserved: string[] = [];

  for (const server of importableServers) {
    if (!server.enabled) {
      continue;
    }
    const key = server.name.trim();
    if (!key) {
      continue;
    }
    const normalizedKey = normalizeMcpServerName(key);
    if (CCB_RESERVED_MCP_NAMES.has(normalizedKey)) {
      skippedReserved.push(key);
      continue;
    }
    if (existingNames.has(normalizedKey)) {
      skippedExisting.push(key);
      continue;
    }
    const entry = mcpServerToSettingsEntry(server);
    if (!entry) {
      continue;
    }
    settings.mcpServers![key] = entry;
    existingNames.add(normalizedKey);
    imported.push(key);
  }

  return { settings, imported, skippedExisting, skippedReserved };
}

/** Strip AionUI-local runtime overrides when CCB-Wanding owns session capabilities. */
export function stripAionUiRuntimeOverridesForCcb<T extends CcbSessionRuntimeOverrides>(
  overrides: T,
  useCcbRuntime: boolean
): T {
  if (!useCcbRuntime) {
    return overrides;
  }
  const next = { ...overrides };
  delete next.model;
  delete next.skill_ids;
  delete next.disabled_builtin_skill_ids;
  delete next.mcp_ids;
  return next;
}

export function stripCcbConversationExtra<T extends Record<string, unknown>>(
  extra: T,
  useCcbRuntime: boolean
): T {
  if (!useCcbRuntime) {
    return extra;
  }
  const next = { ...extra };
  delete next.selected_mcp_server_ids;
  delete next.selected_session_mcp_servers;
  delete next.skills;
  delete next.preset_context;
  delete next.preset_rules;
  const nextWithMeta = next as T & { acp_meta?: Record<string, unknown> };
  if (nextWithMeta.acp_meta && typeof nextWithMeta.acp_meta === 'object') {
    const acpMeta = { ...nextWithMeta.acp_meta };
    delete acpMeta.preset_context;
    delete acpMeta.preset_rules;
    nextWithMeta.acp_meta = acpMeta;
  }
  return next;
}
