/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Main-process CCB-Wanding agent I/O (agents/*.md + *.aionui.json).
 * Renderer must use ccbAgentsService IPC.
 */

import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { agentIdLookupCandidates, normalizeAgentId } from './ccbAgentIdShared';
import { resolveCcbClaudeConfigDir } from './ccbWandingRuntime';
import { isCcbWandingInstallPresent } from './ccbWandingRuntimeNode';

export type CcbAgentSidecarSource = 'user' | 'bundled' | 'imported';

export type CcbAgentRecord = {
  id: string;
  name: string;
  /** UI display title; falls back to `name` when omitted */
  display_name?: string;
  description?: string;
  model?: string | null;
  permission_mode?: string | null;
  system_prompt?: string;
  schema_version: 1;
  guid_primary?: boolean;
  delegatable?: boolean;
  enabled: boolean;
  avatar?: string;
  sort_order?: number;
  recommended_prompts: string[];
  claude_md?: string;
  mcp_allowlist: string[];
  skills: {
    enabled: string[];
    disabled: string[];
  };
  source: CcbAgentSidecarSource;
  created_at: string;
  updated_at: string;
};

export type CcbAgentInput = Partial<CcbAgentRecord> & {
  id: string;
  name: string;
};

type ParsedAgentMarkdown = {
  frontmatter: Record<string, string>;
  body: string;
};

function getAgentsDir(configDir = resolveCcbClaudeConfigDir()): string {
  if (!configDir) throw new Error('CCB-Wanding config directory not found');
  return join(configDir, 'agents');
}

function getAgentMdPath(id: string, configDir = resolveCcbClaudeConfigDir()): string {
  const safeId = normalizeAgentId(id);
  if (!safeId) throw new Error('Invalid CCB agent id');
  return join(getAgentsDir(configDir), `${safeId}.md`);
}

function getAgentSidecarPath(id: string, configDir = resolveCcbClaudeConfigDir()): string {
  const safeId = normalizeAgentId(id);
  if (!safeId) throw new Error('Invalid CCB agent id');
  return join(getAgentsDir(configDir), `${safeId}.aionui.json`);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function parseSkillsFromFrontmatter(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function parseMcpServersFromFrontmatter(frontmatter: Record<string, string>, rawMd: string): string[] {
  const inline = frontmatter.mcpServers?.trim();
  if (inline) {
    return inline
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const blockMatch = rawMd.match(/^mcpServers:\s*\n((?:\s+-\s+.+\n?)+)/m);
  if (!blockMatch) return [];
  return [...blockMatch[1].matchAll(/^\s+-\s+(.+)$/gm)]
    .map((m) => m[1].trim())
    .filter(Boolean);
}

function parseFrontmatterBlockScalar(lines: string[], startIndex: number): { value: string; nextIndex: number } {
  const block: string[] = [];
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === '') {
      block.push('');
      index++;
      continue;
    }
    if (!line.startsWith('  ') && !line.startsWith('\t')) {
      break;
    }
    block.push(line.replace(/^(?:  |\t)/, ''));
    index++;
  }
  return { value: block.join('\n').trim(), nextIndex: index };
}

function parseAgentMarkdown(raw: string): ParsedAgentMarkdown | null {
  const match = raw.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;

  const frontmatter: Record<string, string> = {};
  const lines = match[1].split(/\r?\n/);
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) {
      index++;
      continue;
    }
    const key = kv[1];
    let value = kv[2].trim();
    if (value === '|' || value === '>') {
      const block = parseFrontmatterBlockScalar(lines, index + 1);
      frontmatter[key] = block.value;
      index = block.nextIndex;
      continue;
    }
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value.replace(/\\n/g, '\n');
    index++;
  }

  return { frontmatter, body: match[2] ?? '' };
}

function serializeAgentMarkdown(record: CcbAgentRecord): string {
  const lines = ['---', `name: ${record.name}`];
  if (record.description?.trim()) {
    lines.push(`description: "${record.description.replace(/\n/g, '\\n')}"`);
  }
  if (record.model?.trim()) {
    lines.push(`model: ${record.model.trim()}`);
  }
  if (record.permission_mode?.trim()) {
    lines.push(`permissionMode: ${record.permission_mode.trim()}`);
  }
  if (record.mcp_allowlist.length > 0) {
    lines.push('mcpServers:');
    for (const server of record.mcp_allowlist) {
      lines.push(`  - ${server.trim()}`);
    }
  }
  if (record.skills.enabled.length > 0) {
    lines.push(`skills: ${record.skills.enabled.join(', ')}`);
  }
  lines.push('---', '');
  if (record.system_prompt?.trim()) {
    lines.push(record.system_prompt.trim());
  }
  return `${lines.join('\n')}\n`;
}

function serializeAgentSidecar(record: CcbAgentRecord): Record<string, unknown> {
  return {
    schema_version: 1,
    agent_id: record.id,
    guid_primary: record.guid_primary === true,
    delegatable: record.delegatable !== false,
    enabled: record.enabled !== false,
    ...(record.avatar?.trim() ? { avatar: record.avatar.trim() } : {}),
    ...(record.display_name?.trim() ? { display_name: record.display_name.trim() } : {}),
    ...(typeof record.sort_order === 'number' && Number.isFinite(record.sort_order)
      ? { sort_order: record.sort_order }
      : {}),
    recommended_prompts: record.recommended_prompts,
    mcp_allowlist: record.mcp_allowlist,
    skills: {
      enabled: record.skills.enabled,
      disabled: record.skills.disabled,
    },
    source: record.source,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

/** Fold legacy sidecar claude_md into L1 body; sidecar no longer stores runtime claude_md. */
export function materializeCcbAgentRecordForSave(
  input: CcbAgentInput,
  existing: CcbAgentRecord | null,
  now: string,
): CcbAgentRecord {
  const safeId = normalizeAgentId(input.id);
  if (!safeId) throw new Error('Invalid CCB agent id');

  const effectiveSystemPrompt = resolveSystemPromptForSave(input, existing);

  return {
    id: safeId,
    name: input.name.trim(),
    ...(input.description !== undefined
      ? input.description
        ? { description: input.description }
        : {}
      : existing?.description
        ? { description: existing.description }
        : {}),
    model: input.model !== undefined ? input.model : (existing?.model ?? null),
    permission_mode:
      input.permission_mode !== undefined
        ? input.permission_mode
        : (existing?.permission_mode ?? null),
    ...(effectiveSystemPrompt ? { system_prompt: effectiveSystemPrompt } : {}),
    schema_version: 1,
    guid_primary: input.guid_primary ?? existing?.guid_primary,
    delegatable: input.delegatable ?? existing?.delegatable,
    enabled: input.enabled ?? existing?.enabled ?? true,
    ...(input.display_name !== undefined
      ? input.display_name?.trim()
        ? { display_name: input.display_name.trim() }
        : {}
      : existing?.display_name
        ? { display_name: existing.display_name }
        : {}),
    ...(input.avatar !== undefined
      ? input.avatar?.trim()
        ? { avatar: input.avatar.trim() }
        : {}
      : existing?.avatar
        ? { avatar: existing.avatar }
        : {}),
    sort_order: input.sort_order ?? existing?.sort_order,
    recommended_prompts: input.recommended_prompts ?? existing?.recommended_prompts ?? [],
    mcp_allowlist: input.mcp_allowlist ?? existing?.mcp_allowlist ?? [],
    skills: input.skills ?? existing?.skills ?? { enabled: [], disabled: [] },
    source: input.source ?? existing?.source ?? 'user',
    created_at: existing?.created_at ?? input.created_at ?? now,
    updated_at: now,
  };
}

function resolveEffectiveSystemPrompt(
  systemPrompt: string | undefined,
  claudeMd: string | undefined,
): string | undefined {
  const body = systemPrompt?.trim() ?? '';
  const legacy = claudeMd?.trim() ?? '';
  if (body) return body;
  if (legacy) return legacy;
  return undefined;
}

function resolveSystemPromptForSave(
  input: CcbAgentInput,
  existing: CcbAgentRecord | null,
): string | undefined {
  if (input.system_prompt !== undefined) {
    return input.system_prompt?.trim() || undefined;
  }
  if (input.claude_md !== undefined) {
    return input.claude_md?.trim() || undefined;
  }
  return resolveEffectiveSystemPrompt(existing?.system_prompt, existing?.claude_md);
}

async function atomicWriteFile(path: string, content: string): Promise<void> {
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, content, 'utf8');
  await rename(tmpPath, path);
}

export function normalizeCcbAgentRecord(
  md: ParsedAgentMarkdown,
  sidecarRaw: unknown,
  lookupId: string,
  now = new Date().toISOString(),
  rawMd = '',
): CcbAgentRecord | null {
  const name = md.frontmatter.name?.trim() ?? '';
  if (!name) return null;

  const sidecar =
    sidecarRaw && typeof sidecarRaw === 'object' ? (sidecarRaw as Record<string, unknown>) : {};
  const id = normalizeAgentId(String(sidecar.agent_id ?? md.frontmatter.name ?? lookupId));
  if (!id) return null;

  const description = md.frontmatter.description?.trim() || undefined;
  const modelRaw = md.frontmatter.model?.trim();
  const model = modelRaw && modelRaw.toLowerCase() !== 'inherit' ? modelRaw : null;
  const permission_mode = md.frontmatter.permissionMode?.trim() || null;
  const skillsFromSidecar = asStringArray(
    sidecar.skills && typeof sidecar.skills === 'object'
      ? (sidecar.skills as Record<string, unknown>).enabled
      : undefined
  );
  const skillsFromFrontmatter = parseSkillsFromFrontmatter(md.frontmatter.skills);
  const skillsDisabled = asStringArray(
    sidecar.skills && typeof sidecar.skills === 'object'
      ? (sidecar.skills as Record<string, unknown>).disabled
      : undefined
  );
  const source =
    sidecar.source === 'bundled' || sidecar.source === 'imported' ? sidecar.source : 'user';

  const displayName =
    typeof sidecar.display_name === 'string' && sidecar.display_name.trim()
      ? sidecar.display_name.trim()
      : undefined;

  const sidecarClaudeMd =
    typeof sidecar.claude_md === 'string' && sidecar.claude_md.trim()
      ? sidecar.claude_md.trim()
      : undefined;
  const system_prompt = resolveEffectiveSystemPrompt(
    md.body.trim() || undefined,
    sidecarClaudeMd,
  );

  const mcpFromFrontmatter = parseMcpServersFromFrontmatter(md.frontmatter, rawMd);
  const mcpFromSidecar = asStringArray(sidecar.mcp_allowlist);
  const mcp_allowlist = mcpFromFrontmatter.length > 0 ? mcpFromFrontmatter : mcpFromSidecar;

  return {
    id,
    name,
    ...(displayName ? { display_name: displayName } : {}),
    ...(description ? { description } : {}),
    model,
    permission_mode,
    ...(system_prompt ? { system_prompt } : {}),
    schema_version: 1,
    guid_primary: sidecar.guid_primary === true,
    delegatable: sidecar.delegatable !== false,
    enabled: sidecar.enabled !== false,
    ...(typeof sidecar.avatar === 'string' && sidecar.avatar.trim()
      ? { avatar: sidecar.avatar.trim() }
      : {}),
    ...(typeof sidecar.sort_order === 'number' && Number.isFinite(sidecar.sort_order)
      ? { sort_order: sidecar.sort_order }
      : {}),
    recommended_prompts: asStringArray(sidecar.recommended_prompts),
    ...(sidecarClaudeMd && !md.body.trim() ? { claude_md: sidecarClaudeMd } : {}),
    mcp_allowlist,
    skills: {
      enabled: skillsFromSidecar.length > 0 ? skillsFromSidecar : skillsFromFrontmatter,
      disabled: skillsDisabled,
    },
    source,
    created_at: typeof sidecar.created_at === 'string' ? sidecar.created_at : now,
    updated_at: typeof sidecar.updated_at === 'string' ? sidecar.updated_at : now,
  };
}

async function readAgentRecordFromPaths(
  mdPath: string,
  sidecarPath: string,
  lookupId: string
): Promise<CcbAgentRecord | null> {
  try {
    const mdRaw = await readFile(mdPath, 'utf8');
    const parsed = parseAgentMarkdown(mdRaw);
    if (!parsed) return null;

    let sidecarRaw: unknown = null;
    if (existsSync(sidecarPath)) {
      try {
        sidecarRaw = JSON.parse((await readFile(sidecarPath, 'utf8')).replace(/^\uFEFF/, ''));
      } catch {
        sidecarRaw = null;
      }
    }

    return normalizeCcbAgentRecord(parsed, sidecarRaw, lookupId, new Date().toISOString(), mdRaw);
  } catch {
    return null;
  }
}

export async function listCcbAgents(configDir = resolveCcbClaudeConfigDir()): Promise<CcbAgentRecord[]> {
  if (!configDir || !isCcbWandingInstallPresent(configDir)) return [];

  const agentsDir = getAgentsDir(configDir);
  if (!existsSync(agentsDir)) return [];

  const entries = await readdir(agentsDir).catch((): string[] => []);
  const agents = await Promise.all(
    entries
      .filter((entry) => entry.endsWith('.md'))
      .map(async (entry) => {
        const id = basename(entry, '.md');
        return readAgentRecordFromPaths(
          join(agentsDir, entry),
          join(agentsDir, `${id}.aionui.json`),
          id
        );
      })
  );

  return agents
    .filter((agent): agent is CcbAgentRecord => Boolean(agent))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCcbAgent(
  id: string,
  configDir = resolveCcbClaudeConfigDir()
): Promise<CcbAgentRecord | null> {
  if (!configDir) return null;

  for (const candidate of agentIdLookupCandidates(id)) {
    const record = await readAgentRecordFromPaths(
      getAgentMdPath(candidate, configDir),
      getAgentSidecarPath(candidate, configDir),
      candidate
    );
    if (record) return record;
  }
  return null;
}

export async function saveCcbAgent(input: CcbAgentInput): Promise<CcbAgentRecord> {
  const now = new Date().toISOString();
  const existing = await getCcbAgent(input.id);
  const record = materializeCcbAgentRecordForSave(input, existing, now);

  if (!record.name.trim()) throw new Error('Invalid CCB agent');

  await mkdir(getAgentsDir(), { recursive: true });
  await atomicWriteFile(getAgentMdPath(record.id), serializeAgentMarkdown(record));
  await atomicWriteFile(
    getAgentSidecarPath(record.id),
    `${JSON.stringify(serializeAgentSidecar(record), null, 2)}\n`
  );

  return record;
}

export async function deleteCcbAgent(id: string): Promise<void> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir) return;

  for (const candidate of agentIdLookupCandidates(id)) {
    await rm(getAgentMdPath(candidate, configDir), { force: true });
    await rm(getAgentSidecarPath(candidate, configDir), { force: true });
  }
}
