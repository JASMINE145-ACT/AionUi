/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Settings navigation contract — retired tabs redirect to canonical surfaces.
 * Team Members settings retired in favor of Settings → 组织 (`/settings/org`).
 */

/** When false, Settings sider must not show「团队成员」. */
export const SETTINGS_TEAM_MEMBERS_ENABLED = false;

/**
 * Legacy settings paths → canonical redirect targets.
 * Router must Navigate; pages for these paths must not render create-user forms.
 */
export const RETIRED_SETTINGS_REDIRECTS = {
  'team-members': '/settings/org',
} as const;

export type RetiredSettingsTabId = keyof typeof RETIRED_SETTINGS_REDIRECTS;

export function retiredSettingsRedirect(tabId: string): string | undefined {
  return RETIRED_SETTINGS_REDIRECTS[tabId as RetiredSettingsTabId];
}
