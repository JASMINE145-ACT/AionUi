/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { existsSyncMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn(() => false),
}));

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: existsSyncMock,
  };
});

vi.mock('@/common/config/ccbWandingRuntimeNode', () => ({
  resolveCcbWandingInstallDir: vi.fn(() => null),
  resolveCcbInstallerRoot: vi.fn(() => null),
}));

describe('resolveWandingBusinessKnowledgeShadowPath', () => {
  const originalEnv = process.env.WANDING_BUSINESS_KNOWLEDGE_PATH;
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.resetModules();
    existsSyncMock.mockReset();
    existsSyncMock.mockReturnValue(false);
    delete process.env.WANDING_BUSINESS_KNOWLEDGE_PATH;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.WANDING_BUSINESS_KNOWLEDGE_PATH;
    } else {
      process.env.WANDING_BUSINESS_KNOWLEDGE_PATH = originalEnv;
    }
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('prefers WANDING_BUSINESS_KNOWLEDGE_PATH env', async () => {
    process.env.WANDING_BUSINESS_KNOWLEDGE_PATH = 'C:\\custom\\wanding_business_knowledge.md';
    const { resolveWandingBusinessKnowledgeShadowPath } = await import(
      '@/process/utils/wandingBusinessKnowledgePath'
    );
    expect(resolveWandingBusinessKnowledgeShadowPath()).toBe('C:\\custom\\wanding_business_knowledge.md');
  });

  it('returns null on win32 when CCB-Wanding is not present', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    existsSyncMock.mockReturnValue(false);

    const { resolveWandingBusinessKnowledgeShadowPath } = await import(
      '@/process/utils/wandingBusinessKnowledgePath'
    );
    expect(resolveWandingBusinessKnowledgeShadowPath()).toBeNull();
  });

  it('returns win32 fallback when CCB-Wanding dist exists', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    existsSyncMock.mockImplementation((p) => String(p).includes('D:\\CCB-Wanding\\dist'));

    const { resolveWandingBusinessKnowledgeShadowPath } = await import(
      '@/process/utils/wandingBusinessKnowledgePath'
    );
    expect(resolveWandingBusinessKnowledgeShadowPath()).toBe(
      'D:\\CCB-Wanding\\vendor\\wanding\\data\\wanding_business_knowledge.md'
    );
  });
});
