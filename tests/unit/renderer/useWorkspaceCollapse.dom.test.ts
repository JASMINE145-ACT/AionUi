/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceCollapse } from '@/renderer/pages/conversation/hooks/useWorkspaceCollapse';
import {
  WORKSPACE_HAS_FILES_EVENT,
  type WorkspaceHasFilesDetail,
} from '@/renderer/utils/workspace/workspaceEvents';

const showWorkspaceAutoOpenToastMock = vi.fn();

vi.mock('@/renderer/utils/workspace/workspaceAutoOpenToast', () => ({
  showWorkspaceAutoOpenToast: (...args: unknown[]) => showWorkspaceAutoOpenToastMock(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const dispatchHasFiles = (detail: WorkspaceHasFilesDetail) => {
  window.dispatchEvent(
    new CustomEvent(WORKSPACE_HAS_FILES_EVENT, {
      detail,
    }),
  );
};

describe('useWorkspaceCollapse', () => {
  beforeEach(() => {
    localStorage.clear();
    showWorkspaceAutoOpenToastMock.mockReset();
  });

  it('auto-expands on mid-session hasFiles when no user preference', () => {
    const { result } = renderHook(() =>
      useWorkspaceCollapse({
        workspaceEnabled: true,
        isMobile: false,
        preferenceKey: 'conv-1',
        isTemporaryWorkspace: true,
      }),
    );

    expect(result.current.rightSiderCollapsed).toBe(true);

    act(() => {
      dispatchHasFiles({
        hasFiles: true,
        conversation_id: 'conv-1',
        isInitial: false,
      });
    });

    expect(result.current.rightSiderCollapsed).toBe(false);
  });

  it('shows toast CTA instead of auto-expanding when user collapsed the panel', () => {
    localStorage.setItem('workspace-preference-conv-1', 'collapsed');

    const { result } = renderHook(() =>
      useWorkspaceCollapse({
        workspaceEnabled: true,
        isMobile: false,
        preferenceKey: 'conv-1',
        isTemporaryWorkspace: true,
      }),
    );

    act(() => {
      dispatchHasFiles({
        hasFiles: true,
        conversation_id: 'conv-1',
        isInitial: false,
      });
    });

    expect(result.current.rightSiderCollapsed).toBe(true);
    expect(showWorkspaceAutoOpenToastMock).toHaveBeenCalledTimes(1);
  });
});
