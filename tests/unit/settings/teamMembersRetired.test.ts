/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import {
  RETIRED_SETTINGS_REDIRECTS,
  SETTINGS_TEAM_MEMBERS_ENABLED,
  retiredSettingsRedirect,
} from '@/common/config/settingsNavContract';
import { BUILTIN_TAB_IDS } from '@/renderer/pages/settings/components/SettingsSider';

describe('WANd.ORG.TEAM_MEMBERS_RETIRE.001 — team members settings retired', () => {
  it('disables the Team Members settings tab', () => {
    expect(SETTINGS_TEAM_MEMBERS_ENABLED).toBe(false);
  });

  it('redirects legacy /settings/team-members to /settings/org', () => {
    expect(RETIRED_SETTINGS_REDIRECTS['team-members']).toBe('/settings/org');
    expect(retiredSettingsRedirect('team-members')).toBe('/settings/org');
  });

  it('does not list team-members in builtin settings tabs', () => {
    expect([...BUILTIN_TAB_IDS]).not.toContain('team-members');
  });
});
