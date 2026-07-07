import { describe, expect, it } from 'vitest';
import {
  resolveKnowledgeContinuityOnRefresh,
  shouldDeferConversationRefresh,
} from '@/common/config/knowledgeContinuity';
import { KNOWLEDGE_EXTRA_KEYS } from '@/common/config/ccbContinuitySnapshotShared';
import type { CcbContinuitySnapshot } from '@/common/config/ccbContinuitySnapshotShared';

const SNAPSHOT: CcbContinuitySnapshot = {
  ship_config_generation: 5,
  user_config_generation: 5,
  installed_version: '1.1.7',
  app_version: '1.7.0',
  kb_content_hash: 'hash-v2',
};

describe('shouldDeferConversationRefresh', () => {
  it('returns true when processing', () => {
    expect(
      shouldDeferConversationRefresh({
        runtime: {
          state: 'running',
          is_processing: true,
          can_send_message: false,
          has_task: true,
          pending_confirmations: 0,
          turn_id: 't1',
        },
      }),
    ).toBe(true);
  });

  it('returns true when waiting confirmation', () => {
    expect(
      shouldDeferConversationRefresh({
        runtime: {
          state: 'waiting_confirmation',
          is_processing: false,
          can_send_message: false,
          has_task: true,
          pending_confirmations: 1,
          turn_id: 't1',
        },
      }),
    ).toBe(true);
  });

  it('returns false when idle', () => {
    expect(
      shouldDeferConversationRefresh({
        runtime: {
          state: 'idle',
          is_processing: false,
          can_send_message: true,
          has_task: false,
          pending_confirmations: 0,
          turn_id: null,
        },
      }),
    ).toBe(false);
  });
});

describe('resolveKnowledgeContinuityOnRefresh', () => {
  it('inherits when kb hash unchanged', () => {
    const decision = resolveKnowledgeContinuityOnRefresh(
      {
        [KNOWLEDGE_EXTRA_KEYS.kb_content_hash]: 'hash-v2',
        [KNOWLEDGE_EXTRA_KEYS.read_at_generation]: 4,
        [KNOWLEDGE_EXTRA_KEYS.match_count_since_read]: 2,
        [KNOWLEDGE_EXTRA_KEYS.invalidated]: false,
      },
      SNAPSHOT,
    );
    expect(decision.inherit).toBe(true);
    expect(decision.invalidate).toBe(false);
    expect(decision.diskState.match_count_since_read).toBe(2);
  });

  it('invalidates and notices when kb hash changed', () => {
    const decision = resolveKnowledgeContinuityOnRefresh(
      {
        [KNOWLEDGE_EXTRA_KEYS.kb_content_hash]: 'hash-v1',
        [KNOWLEDGE_EXTRA_KEYS.read_at_generation]: 4,
        [KNOWLEDGE_EXTRA_KEYS.match_count_since_read]: 1,
        [KNOWLEDGE_EXTRA_KEYS.invalidated]: false,
      },
      SNAPSHOT,
    );
    expect(decision.inherit).toBe(false);
    expect(decision.invalidate).toBe(true);
    expect(decision.skipDiskSync).toBe(false);
    expect(decision.userNotice).toContain('业务知识库已更新');
    expect(decision.diskState?.invalidated).toBe(true);
  });

  it('skips disk sync when no prior read in extra', () => {
    const decision = resolveKnowledgeContinuityOnRefresh({}, SNAPSHOT);
    expect(decision.skipDiskSync).toBe(true);
    expect(decision.diskState).toBeUndefined();
  });
});
