/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  claimAcpInitialMessage,
  clearAcpInitialMessage,
  releaseAcpInitialMessageClaim,
  resetAcpInitialMessageStoreForTests,
  stageAcpInitialMessage,
} from '@/renderer/pages/conversation/platforms/acp/acpPendingInitialMessage';

describe('acpPendingInitialMessage', () => {
  beforeEach(() => {
    resetAcpInitialMessageStoreForTests();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    resetAcpInitialMessageStoreForTests();
  });

  it('stages and claims payload once', () => {
    stageAcpInitialMessage('conv-1', { input: 'hello', files: ['a.txt'] });

    expect(claimAcpInitialMessage('conv-1')).toEqual({ input: 'hello', files: ['a.txt'] });
    expect(claimAcpInitialMessage('conv-1')).toBeNull();
  });

  it('keeps payload after claim until explicit clear (survives simulated HMR)', () => {
    stageAcpInitialMessage('conv-1', { input: 'hello' });
    claimAcpInitialMessage('conv-1');

    expect(sessionStorage.getItem('acp_initial_message_conv-1')).toContain('hello');

    releaseAcpInitialMessageClaim('conv-1');
    expect(claimAcpInitialMessage('conv-1')).toEqual({ input: 'hello' });
  });

  it('clears payload only after success path', () => {
    stageAcpInitialMessage('conv-1', { input: 'hello' });
    claimAcpInitialMessage('conv-1');
    clearAcpInitialMessage('conv-1');

    expect(claimAcpInitialMessage('conv-1')).toBeNull();
    expect(sessionStorage.getItem('acp_initial_message_conv-1')).toBeNull();
  });

  it('allows retry after release on failure', () => {
    stageAcpInitialMessage('conv-1', { input: 'retry-me' });
    claimAcpInitialMessage('conv-1');
    releaseAcpInitialMessageClaim('conv-1');

    expect(claimAcpInitialMessage('conv-1')).toEqual({ input: 'retry-me' });
  });
});
