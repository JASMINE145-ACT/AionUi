/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDocInvokeMock = vi.fn();
const invokeIpcMock = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    orgKnowledge: {
      getDoc: {
        invoke: getDocInvokeMock,
      },
    },
  },
}));

describe('syncOrgKnowledgeShadowAfterLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as { window?: { electronAPI?: { invokeIpc: typeof invokeIpcMock } } }).window = {
      electronAPI: { invokeIpc: invokeIpcMock },
    };
  });

  it('fetches org doc and writes shadow via IPC', async () => {
    getDocInvokeMock.mockResolvedValue({
      slug: 'wanding_business_knowledge',
      content: '# from org',
      version: 5,
    });
    invokeIpcMock.mockResolvedValue({ ok: true, path: 'D:\\CCB-Wanding\\vendor\\wanding\\data\\wanding_business_knowledge.md', version: 5 });

    const { syncOrgKnowledgeShadowAfterLogin } = await import('@/common/auth/orgKnowledgeShadowSync');
    const result = await syncOrgKnowledgeShadowAfterLogin();

    expect(result.ok).toBe(true);
    expect(getDocInvokeMock).toHaveBeenCalledWith({ slug: 'wanding_business_knowledge' });
    expect(invokeIpcMock).toHaveBeenCalledWith('org-knowledge-sync-shadow', {
      content: '# from org',
      slug: 'wanding_business_knowledge',
      version: 5,
    });
  });

  it('returns failure when org doc is empty', async () => {
    getDocInvokeMock.mockResolvedValue({ slug: 'wanding_business_knowledge', content: '  ', version: 1 });

    const { syncOrgKnowledgeShadowAfterLogin } = await import('@/common/auth/orgKnowledgeShadowSync');
    const result = await syncOrgKnowledgeShadowAfterLogin();

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('empty_org_doc');
    expect(invokeIpcMock).not.toHaveBeenCalled();
  });

  it('returns failure when electron IPC is unavailable', async () => {
    delete (globalThis as { window?: unknown }).window;

    const { syncOrgKnowledgeShadowAfterLogin } = await import('@/common/auth/orgKnowledgeShadowSync');
    const result = await syncOrgKnowledgeShadowAfterLogin();

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no_electron_ipc');
  });

  it('returns failure when getDoc throws', async () => {
    getDocInvokeMock.mockRejectedValue(new Error('network down'));

    const { syncOrgKnowledgeShadowAfterLogin } = await import('@/common/auth/orgKnowledgeShadowSync');
    const result = await syncOrgKnowledgeShadowAfterLogin();

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('network down');
  });

  it('returns failure when IPC shadow write fails', async () => {
    getDocInvokeMock.mockResolvedValue({
      slug: 'wanding_business_knowledge',
      content: '# from org',
      version: 2,
    });
    invokeIpcMock.mockResolvedValue({ ok: false, reason: 'shadow_path_unresolved' });

    const { syncOrgKnowledgeShadowAfterLogin } = await import('@/common/auth/orgKnowledgeShadowSync');
    const result = await syncOrgKnowledgeShadowAfterLogin();

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('shadow_path_unresolved');
  });
});
