/**
 * @vitest-environment node
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('orgKnowledgeShadowSync (main process)', () => {
  const originalEnv = process.env.WANDING_BUSINESS_KNOWLEDGE_PATH;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.WANDING_BUSINESS_KNOWLEDGE_PATH;
    } else {
      process.env.WANDING_BUSINESS_KNOWLEDGE_PATH = originalEnv;
    }
  });

  it('writes content atomically to configured shadow path', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aionui-knowledge-shadow-'));
    const target = path.join(tmpDir, 'wanding_business_knowledge.md');
    process.env.WANDING_BUSINESS_KNOWLEDGE_PATH = target;

    const { writeWandingBusinessKnowledgeShadow } = await import(
      '@/process/utils/orgKnowledgeShadowSync'
    );

    const result = writeWandingBusinessKnowledgeShadow('# org knowledge\nline 2', {
      slug: 'wanding_business_knowledge',
      version: 3,
    });

    expect(result.ok).toBe(true);
    expect(result.path).toBe(target);
    expect(fs.readFileSync(target, 'utf-8')).toBe('# org knowledge\nline 2');
    const meta = JSON.parse(fs.readFileSync(`${target}.org-meta.json`, 'utf-8')) as {
      slug: string;
      version: number;
      synced_at: number;
    };
    expect(meta.slug).toBe('wanding_business_knowledge');
    expect(meta.version).toBe(3);
    expect(meta.synced_at).toBeTypeOf('number');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns shadow_path_unresolved when path cannot be resolved', async () => {
    vi.resetModules();
    vi.doMock('@/process/utils/wandingBusinessKnowledgePath', () => ({
      resolveWandingBusinessKnowledgeShadowPath: () => null,
    }));

    const { writeWandingBusinessKnowledgeShadow } = await import(
      '@/process/utils/orgKnowledgeShadowSync'
    );
    const result = writeWandingBusinessKnowledgeShadow('# content', { version: 1 });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('shadow_path_unresolved');
  });

  it('rejects empty content', async () => {
    process.env.WANDING_BUSINESS_KNOWLEDGE_PATH = path.join(os.tmpdir(), 'missing.md');
    const { writeWandingBusinessKnowledgeShadow } = await import(
      '@/process/utils/orgKnowledgeShadowSync'
    );
    expect(writeWandingBusinessKnowledgeShadow('   ').ok).toBe(false);
  });
});
