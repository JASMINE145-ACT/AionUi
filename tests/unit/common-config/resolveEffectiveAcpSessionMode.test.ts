import { describe, expect, it } from 'vitest';
import { resolveEffectiveAcpSessionMode } from '@/common/config/resolveEffectiveAcpSessionMode';

describe('resolveEffectiveAcpSessionMode', () => {
  it('prefers live mode over stored conversation extra', () => {
    expect(resolveEffectiveAcpSessionMode('bypassPermissions', 'default')).toBe('bypassPermissions');
  });

  it('falls back to stored mode when live mode is empty', () => {
    expect(resolveEffectiveAcpSessionMode(undefined, 'bypassPermissions')).toBe('bypassPermissions');
    expect(resolveEffectiveAcpSessionMode('', '  acceptEdits  ')).toBe('acceptEdits');
  });

  it('returns undefined when neither mode is set', () => {
    expect(resolveEffectiveAcpSessionMode(undefined, undefined)).toBeUndefined();
    expect(resolveEffectiveAcpSessionMode('  ', '')).toBeUndefined();
  });
});
