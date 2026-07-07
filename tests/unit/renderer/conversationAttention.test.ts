/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  getAttentionUnreadConversationCount,
  parseActiveConversationIdFromPath,
  shouldNotifyConversationAttention,
} from '@/renderer/pages/conversation/GroupedHistory/utils/conversationAttention';

describe('conversationAttention', () => {
  describe('shouldNotifyConversationAttention', () => {
    it('returns false when viewing the same conversation', () => {
      expect(shouldNotifyConversationAttention('conv-a', 'conv-a')).toBe(false);
    });

    it('returns true when active conversation differs', () => {
      expect(shouldNotifyConversationAttention('conv-a', 'conv-b')).toBe(true);
    });

    it('returns true when no conversation is active (Guid/home)', () => {
      expect(shouldNotifyConversationAttention('conv-a', null)).toBe(true);
    });
  });

  describe('getAttentionUnreadConversationCount', () => {
    it('returns 0 when both sets are empty', () => {
      expect(getAttentionUnreadConversationCount(new Set(), new Set())).toBe(0);
    });

    it('counts distinct conversations across permission and completion', () => {
      expect(
        getAttentionUnreadConversationCount(new Set(['a', 'b']), new Set(['b', 'c'])),
      ).toBe(3);
    });

    it('returns single-set size when the other is empty', () => {
      expect(getAttentionUnreadConversationCount(new Set(['a']), new Set())).toBe(1);
      expect(getAttentionUnreadConversationCount(new Set(), new Set(['x', 'y']))).toBe(2);
    });
  });

  describe('parseActiveConversationIdFromPath', () => {
    it('parses conversation route id', () => {
      expect(parseActiveConversationIdFromPath('/conversation/abc-123')).toBe('abc-123');
    });

    it('returns null for non-conversation routes', () => {
      expect(parseActiveConversationIdFromPath('/guid')).toBeNull();
      expect(parseActiveConversationIdFromPath('/')).toBeNull();
    });

    it('parses HashRouter hash path (hash stripped to virtual pathname)', () => {
      // HashRouter stores path in window.location.hash e.g. "#/conversation/abc".
      // Callers must strip the leading "#" before passing to this function.
      expect(parseActiveConversationIdFromPath('/conversation/xyz-456')).toBe('xyz-456');
    });

    it('returns null for bare slash (HashRouter pathname before hash is stripped)', () => {
      // window.location.pathname is always "/" under HashRouter — must use hash path.
      expect(parseActiveConversationIdFromPath('/')).toBeNull();
    });
  });
});
