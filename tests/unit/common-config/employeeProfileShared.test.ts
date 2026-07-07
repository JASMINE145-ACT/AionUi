import { describe, expect, it } from 'vitest';
import {
  derivePreferredAddressName,
  formatEmployeeProfileClaudeMd,
  isEmployeeProfileEmpty,
  mergeEmployeeProfileIntoUserContext,
  normalizeEmployeeProfile,
} from '@/common/config/employeeProfileShared';

describe('employeeProfileShared', () => {
  it('normalizes and trims profile fields', () => {
    const profile = normalizeEmployeeProfile({
      displayName: '  张三 ',
      department: '采购部',
      jobTitle: '',
      notes: 'x'.repeat(600),
    });
    expect(profile?.displayName).toBe('张三');
    expect(profile?.department).toBe('采购部');
    expect(profile?.jobTitle).toBeUndefined();
    expect(profile?.notes?.length).toBe(500);
  });

  it('returns null for empty profile', () => {
    expect(normalizeEmployeeProfile({})).toBeNull();
    expect(isEmployeeProfileEmpty({})).toBe(true);
  });

  it('derives CJK address name from last two chars when addressName empty', () => {
    expect(derivePreferredAddressName({ displayName: '祐嘉诚' })).toBe('嘉诚');
  });

  it('prefers explicit addressName over derivation', () => {
    expect(
      derivePreferredAddressName({ displayName: '祐嘉诚', addressName: 'Jiacheng' })
    ).toBe('Jiacheng');
  });

  it('formats claudeMd with addressing behavior contract', () => {
    const md = formatEmployeeProfileClaudeMd({
      displayName: '祐嘉诚',
      department: 'IP 部门',
      jobTitle: 'Ai agent 开发',
    });
    expect(md).toContain('对话称呼');
    expect(md).toContain('嘉诚');
    expect(md).toContain('优先用「嘉诚」');
    expect(md).toContain('不要**主动列出下方完整登记表');
    expect(md).toContain('IP 部门');
  });

  it('merges employee block without clobbering assistant claudeMd', () => {
    const merged = mergeEmployeeProfileIntoUserContext(
      { claudeMd: '# Router', currentDate: 'Today' },
      { displayName: 'Bob', department: 'Sales' }
    );
    expect(merged?.claudeMd).toContain('# Router');
    expect(merged?.claudeMd).toContain('Bob');
    expect(merged?.currentDate).toBe('Today');
  });
});
