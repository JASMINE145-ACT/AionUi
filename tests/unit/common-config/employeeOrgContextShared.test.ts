import { describe, expect, it } from 'vitest';
import {
  buildEmployeeProfileHandoff,
  mergeEffectiveEmployeeProfile,
  normalizeEmployeeOrgContext,
} from '@/common/config/employeeOrgContextShared';

describe('employeeOrgContextShared', () => {
  it('normalizes org context API payload', () => {
    const org = normalizeEmployeeOrgContext({
      user_id: 'u1',
      username: 'yjc',
      display_name: 'yjc',
      department: '采购部',
      work_task_role: 'employee',
      employment_status: 'active',
      data_scope_max: 'self',
    });
    expect(org?.userId).toBe('u1');
    expect(org?.department).toBe('采购部');
    expect(org?.dataScopeMax).toBe('self');
  });

  it('org department wins over absent client org fields', () => {
    const effective = mergeEffectiveEmployeeProfile(
      {
        userId: 'u1',
        username: 'yjc',
        displayName: 'yjc',
        department: '采购部',
        workTaskRole: 'employee',
        employmentStatus: 'active',
        dataScopeMax: 'self',
      },
      { notes: '习惯先查库存' }
    );
    expect(effective?.department).toBe('采购部');
    expect(effective?.notes).toBe('习惯先查库存');
    expect(effective?.displayName).toBe('yjc');
  });

  it('builds handoff payload', () => {
    const handoff = buildEmployeeProfileHandoff(
      {
        userId: 'u1',
        username: 'yjc',
        displayName: 'yjc',
        workTaskRole: 'employee',
        employmentStatus: 'active',
        dataScopeMax: 'self',
      },
      { notes: 'test' }
    );
    expect(handoff?.org?.username).toBe('yjc');
    expect(handoff?.client?.notes).toBe('test');
  });
});
