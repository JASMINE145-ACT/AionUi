/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Main-process CCB-Wanding assistant profile I/O. Renderer must use
 * ccbAssistantProfilesService IPC.
 */

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveCcbClaudeConfigDir } from './ccbWandingRuntime';
import { isCcbWandingInstallPresent } from './ccbWandingRuntimeNode';

export type CcbAssistantProfile = {
  schema_version: 1;
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  enabled: boolean;
  sort_order?: number;
  source: 'user' | 'bundled' | 'imported';
  created_at: string;
  updated_at: string;
  instructions: {
    system_prompt?: string;
    claude_md?: string;
  };
  recommended_prompts: string[];
  defaults: {
    model?: string | null;
    permission_mode?: string | null;
    skills: {
      enabled: string[];
      disabled: string[];
    };
    mcp: {
      enabled: string[];
      disabled: string[];
    };
  };
};

export type CcbAssistantProfileInput = Partial<CcbAssistantProfile> & {
  id: string;
  name: string;
};

export function normalizeCcbAssistantProfileId(id: string): string {
  return id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getProfilesDir(configDir = resolveCcbClaudeConfigDir()): string {
  if (!configDir) throw new Error('CCB-Wanding config directory not found');
  return join(configDir, 'assistants');
}

function getProfilePath(id: string, configDir = resolveCcbClaudeConfigDir()): string {
  const safeId = normalizeCcbAssistantProfileId(id);
  if (!safeId) throw new Error('Invalid CCB assistant profile id');
  return join(getProfilesDir(configDir), `${safeId}.json`);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function normalizeCcbAssistantProfile(
  value: unknown,
  now = new Date().toISOString()
): CcbAssistantProfile | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = normalizeCcbAssistantProfileId(String(raw.id ?? ''));
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!id || !name) return null;

  const instructions =
    raw.instructions && typeof raw.instructions === 'object' ? (raw.instructions as Record<string, unknown>) : {};
  const defaults = raw.defaults && typeof raw.defaults === 'object' ? (raw.defaults as Record<string, unknown>) : {};
  const skills = defaults.skills && typeof defaults.skills === 'object' ? (defaults.skills as Record<string, unknown>) : {};
  const mcp = defaults.mcp && typeof defaults.mcp === 'object' ? (defaults.mcp as Record<string, unknown>) : {};

  return {
    schema_version: 1,
    id,
    name,
    ...(typeof raw.description === 'string' && raw.description.trim() ? { description: raw.description.trim() } : {}),
    ...(typeof raw.avatar === 'string' && raw.avatar.trim() ? { avatar: raw.avatar.trim() } : {}),
    enabled: raw.enabled !== false,
    ...(typeof raw.sort_order === 'number' && Number.isFinite(raw.sort_order) ? { sort_order: raw.sort_order } : {}),
    source: raw.source === 'bundled' || raw.source === 'imported' ? raw.source : 'user',
    created_at: typeof raw.created_at === 'string' ? raw.created_at : now,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : now,
    instructions: {
      ...(typeof instructions.system_prompt === 'string' && instructions.system_prompt.trim()
        ? { system_prompt: instructions.system_prompt }
        : {}),
      ...(typeof instructions.claude_md === 'string' && instructions.claude_md.trim()
        ? { claude_md: instructions.claude_md }
        : {}),
    },
    recommended_prompts: asStringArray(raw.recommended_prompts),
    defaults: {
      model: typeof defaults.model === 'string' && defaults.model.trim() ? defaults.model.trim() : null,
      permission_mode:
        typeof defaults.permission_mode === 'string' && defaults.permission_mode.trim()
          ? defaults.permission_mode.trim()
          : null,
      skills: {
        enabled: asStringArray(skills.enabled),
        disabled: asStringArray(skills.disabled),
      },
      mcp: {
        enabled: asStringArray(mcp.enabled),
        disabled: asStringArray(mcp.disabled),
      },
    },
  };
}

export async function listCcbAssistantProfiles(): Promise<CcbAssistantProfile[]> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir || !isCcbWandingInstallPresent(configDir)) return [];

  const profilesDir = getProfilesDir(configDir);
  if (!existsSync(profilesDir)) return [];

  const entries = await readdir(profilesDir).catch((): string[] => []);
  const profiles = await Promise.all(
    entries
      .filter((entry) => entry.endsWith('.json'))
      .map(async (entry) => {
        try {
          const raw = JSON.parse((await readFile(join(profilesDir, entry), 'utf8')).replace(/^\uFEFF/, ''));
          return normalizeCcbAssistantProfile(raw);
        } catch {
          return null;
        }
      })
  );

  return profiles.filter((profile): profile is CcbAssistantProfile => Boolean(profile)).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCcbAssistantProfile(id: string): Promise<CcbAssistantProfile | null> {
  const candidates = [
    id,
    id.replace(/^builtin-/i, ''),
    normalizeCcbAssistantProfileId(id),
    normalizeCcbAssistantProfileId(id.replace(/^builtin-/i, '')),
  ].filter((value, index, array) => value && array.indexOf(value) === index);

  for (const candidate of candidates) {
    try {
      const raw = JSON.parse((await readFile(getProfilePath(candidate), 'utf8')).replace(/^\uFEFF/, ''));
      const profile = normalizeCcbAssistantProfile(raw);
      if (profile) return profile;
    } catch {
      // try next alias
    }
  }
  return null;
}

export async function saveCcbAssistantProfile(input: CcbAssistantProfileInput): Promise<CcbAssistantProfile> {
  const now = new Date().toISOString();
  const existing = await getCcbAssistantProfile(input.id);
  const profile = normalizeCcbAssistantProfile(
    {
      ...input,
      created_at: existing?.created_at ?? input.created_at ?? now,
      updated_at: now,
    },
    now
  );
  if (!profile) throw new Error('Invalid CCB assistant profile');

  await mkdir(getProfilesDir(), { recursive: true });
  await writeFile(getProfilePath(profile.id), `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
  return profile;
}

export async function deleteCcbAssistantProfile(id: string): Promise<void> {
  await rm(getProfilePath(id), { force: true });
}
