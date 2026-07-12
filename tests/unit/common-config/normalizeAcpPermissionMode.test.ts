import { describe, expect, it } from 'vitest';
import { normalizeAcpPermissionMode } from '@/common/config/normalizeAcpPermissionMode';

describe('normalizeAcpPermissionMode', () => {
  it('maps yolo to bypassPermissions for claude/CCB', () => {
    expect(normalizeAcpPermissionMode('claude', 'yolo')).toBe('bypassPermissions');
    expect(normalizeAcpPermissionMode('claude', ' yolo ')).toBe('bypassPermissions');
    expect(normalizeAcpPermissionMode('claude', 'yoloNoSandbox')).toBe('bypassPermissions');
  });

  it('defaults unknown backend to claude full-auto when alias is yolo', () => {
    expect(normalizeAcpPermissionMode(undefined, 'yolo')).toBe('bypassPermissions');
  });

  it('keeps native yolo for gemini/qwen', () => {
    expect(normalizeAcpPermissionMode('gemini', 'yolo')).toBe('yolo');
    expect(normalizeAcpPermissionMode('qwen', 'yolo')).toBe('yolo');
  });

  it('passes through non-alias modes', () => {
    expect(normalizeAcpPermissionMode('claude', 'bypassPermissions')).toBe('bypassPermissions');
    expect(normalizeAcpPermissionMode('claude', 'default')).toBe('default');
    expect(normalizeAcpPermissionMode('claude', 'acceptEdits')).toBe('acceptEdits');
  });

  it('returns empty for blank input', () => {
    expect(normalizeAcpPermissionMode('claude', '')).toBe('');
    expect(normalizeAcpPermissionMode('claude', null)).toBe('');
    expect(normalizeAcpPermissionMode('claude', undefined)).toBe('');
  });
});
