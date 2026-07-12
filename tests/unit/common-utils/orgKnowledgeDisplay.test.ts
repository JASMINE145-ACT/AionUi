import { describe, expect, it } from 'vitest';
import {
  buildOrgKnowledgeUserLabelLookup,
  getOrgKnowledgeUpdaterLabel,
  historyNeedsUserLabelLookup,
  ORG_KNOWLEDGE_LEGACY_USER_LABELS,
} from '../../../packages/desktop/src/common/types/orgKnowledge/orgKnowledgeDisplay';

describe('getOrgKnowledgeUpdaterLabel', () => {
  it('prefers updated_by.username', () => {
    expect(
      getOrgKnowledgeUpdaterLabel({
        updated_by_id: 'user_abc',
        updated_by: { id: 'user_abc', username: 'admin' },
      })
    ).toBe('admin');
  });

  it('uses member lookup when updated_by missing', () => {
    const lookup = buildOrgKnowledgeUserLabelLookup([
      { id: 'user_019ede87', username: 'yjc' },
    ]);
    expect(
      getOrgKnowledgeUpdaterLabel(
        { updated_by_id: 'user_019ede87', updated_by: null },
        'unknown',
        lookup
      )
    ).toBe('yjc');
  });

  it('maps legacy system_default_user to admin', () => {
    expect(
      getOrgKnowledgeUpdaterLabel({
        updated_by_id: 'system_default_user',
        updated_by: null,
      })
    ).toBe('admin');
    expect(ORG_KNOWLEDGE_LEGACY_USER_LABELS.system_default_user).toBe('admin');
  });

  it('falls back to updated_by_id when username missing', () => {
    expect(
      getOrgKnowledgeUpdaterLabel({
        updated_by_id: 'user_unknown_xyz',
        updated_by: null,
      })
    ).toBe('user_unknown_xyz');
  });

  it('returns unknown label when both empty', () => {
    expect(
      getOrgKnowledgeUpdaterLabel(
        { updated_by_id: '', updated_by: null },
        'unknown'
      )
    ).toBe('unknown');
  });
});

describe('historyNeedsUserLabelLookup', () => {
  it('true when any row lacks updated_by.username', () => {
    expect(
      historyNeedsUserLabelLookup([
        { updated_by_id: 'u1', updated_by: { id: 'u1', username: 'admin' } },
        { updated_by_id: 'u2', updated_by: null },
      ])
    ).toBe(true);
  });

  it('false when all rows enriched', () => {
    expect(
      historyNeedsUserLabelLookup([
        { updated_by_id: 'u1', updated_by: { id: 'u1', username: 'admin' } },
      ])
    ).toBe(false);
  });
});
