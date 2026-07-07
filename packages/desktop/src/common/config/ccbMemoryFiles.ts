/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Local memory files under CCB-Wanding `.claude/memory/` (path-jailed).
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolveCcbClaudeConfigDir } from './ccbWandingRuntime';

export type MemoryScope = 'personal' | 'business';

export type MemoryFileSummary = {
  scope: MemoryScope;
  name: string;
  /** Relative path from memory root, e.g. personal/workflow.md */
  relPath: string;
  size: number;
  mtimeMs: number;
};

export type MemoryFileContent = {
  relPath: string;
  content: string;
};

const SCOPES: MemoryScope[] = ['personal', 'business'];

function memoryRoot(configDir: string): string {
  return path.join(configDir, 'memory');
}

/** Resolve and jail a relative path under memory/. Returns null if invalid. */
export function resolveMemoryRelPath(configDir: string, relPath: string): string | null {
  const root = path.resolve(memoryRoot(configDir));
  const normalized = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0')) return null;
  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((s) => s === '..' || s === '.')) return null;
  if (segments.length < 2) return null;
  const scope = segments[0];
  if (scope !== 'personal' && scope !== 'business') return null;
  const fileName = segments[segments.length - 1];
  if (!fileName.toLowerCase().endsWith('.md')) return null;

  const absolute = path.resolve(root, ...segments);
  const relToRoot = path.relative(root, absolute);
  if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) return null;
  return absolute;
}

export function listMemoryFiles(scope: MemoryScope): MemoryFileSummary[] {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir) return [];

  const dir = path.join(memoryRoot(configDir), scope);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];

  const out: MemoryFileSummary[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.toLowerCase().endsWith('.md')) continue;
    const abs = path.join(dir, name);
    let st: fs.Stats;
    try {
      st = fs.statSync(abs);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    out.push({
      scope,
      name,
      relPath: `${scope}/${name}`.replace(/\\/g, '/'),
      size: st.size,
      mtimeMs: st.mtimeMs,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export function readMemoryFile(relPath: string): MemoryFileContent | null {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir) return null;
  const abs = resolveMemoryRelPath(configDir, relPath);
  if (!abs || !fs.existsSync(abs)) return null;
  const content = fs.readFileSync(abs, 'utf8');
  return { relPath: relPath.replace(/\\/g, '/'), content };
}

export function writeMemoryFile(relPath: string, content: string): MemoryFileContent {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir) {
    throw new Error('CCB-Wanding config directory not found');
  }
  const abs = resolveMemoryRelPath(configDir, relPath);
  if (!abs) {
    throw new Error('Invalid memory path');
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, { encoding: 'utf8' });
  return { relPath: relPath.replace(/\\/g, '/'), content };
}

export function isValidMemoryScope(scope: string): scope is MemoryScope {
  return (SCOPES as string[]).includes(scope);
}
