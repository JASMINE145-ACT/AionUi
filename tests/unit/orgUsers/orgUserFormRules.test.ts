/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { checkOrgPassword, checkOrgUsername } from '../../../packages/desktop/src/renderer/pages/orgUsers/orgUserFormRules';

describe('checkOrgUsername', () => {
  it('accepts valid ascii usernames', () => {
    expect(checkOrgUsername('emp01')).toBeNull();
    expect(checkOrgUsername('test_user-1')).toBeNull();
  });

  it('rejects chinese, short, and edge names', () => {
    expect(checkOrgUsername('张三丰')).toBe('usernameCharset');
    expect(checkOrgUsername('ab')).toBe('usernameLength');
    expect(checkOrgUsername('_emp')).toBe('usernameEdge');
    expect(checkOrgUsername('emp_')).toBe('usernameEdge');
  });
});

describe('checkOrgPassword', () => {
  it('accepts strong enough passwords', () => {
    expect(checkOrgPassword('StrongP@ss1')).toBeNull();
  });

  it('rejects short, max, and weak passwords', () => {
    expect(checkOrgPassword('short')).toBe('passwordMin');
    expect(checkOrgPassword('a'.repeat(129))).toBe('passwordMax');
    expect(checkOrgPassword('password')).toBe('passwordWeak');
    expect(checkOrgPassword('PASSWORD')).toBe('passwordWeak');
    expect(checkOrgPassword('12345678')).toBe('passwordWeak');
  });
});
