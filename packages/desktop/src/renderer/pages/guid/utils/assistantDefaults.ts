/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AssistantDetail } from '@/common/types/agent/assistantTypes';
import { normalizeAcpPermissionMode } from '@/common/config/normalizeAcpPermissionMode';

export type ResolvedGuidAssistantDefaults = {
  modelId?: string;
  permissionMode?: string;
  skillIds: string[];
  disabledBuiltinSkillIds: string[];
  mcpIds: string[];
};

export const resolveGuidAssistantDefaults = (
  detail: AssistantDetail | null | undefined,
  backend?: string,
): ResolvedGuidAssistantDefaults => {
  if (!detail) {
    return {
      modelId: undefined,
      permissionMode: undefined,
      skillIds: [],
      disabledBuiltinSkillIds: [],
      mcpIds: [],
    };
  }

  const effectiveBackend = backend ?? detail.engine?.agent_backend ?? 'claude';

  const modelId =
    detail.defaults.model.mode === 'fixed'
      ? detail.defaults.model.value
      : detail.defaults.model.mode === 'auto'
        ? detail.preferences.last_model_id
        : undefined;

  const rawPermissionMode =
    detail.defaults.permission.mode === 'fixed'
      ? detail.defaults.permission.value
      : detail.defaults.permission.mode === 'auto'
        ? detail.preferences.last_permission_value
        : undefined;
  const permissionMode = normalizeAcpPermissionMode(effectiveBackend, rawPermissionMode) || undefined;

  const skillIds =
    detail.defaults.skills.mode === 'fixed'
      ? (detail.defaults.skills.value ?? [])
      : detail.defaults.skills.mode === 'auto'
        ? (detail.preferences.last_skill_ids ?? [])
        : [];

  const disabledBuiltinSkillIds =
    detail.defaults.skills.mode === 'fixed'
      ? (detail.capabilities.default_disabled_builtin_skill_ids ?? [])
      : detail.defaults.skills.mode === 'auto'
        ? (detail.preferences.last_disabled_builtin_skill_ids ?? [])
        : [];

  const mcpIds =
    detail.defaults.mcps.mode === 'fixed'
      ? (detail.defaults.mcps.value ?? [])
      : detail.defaults.mcps.mode === 'auto'
        ? (detail.preferences.last_mcp_ids ?? [])
        : [];

  return {
    modelId: modelId || undefined,
    permissionMode,
    skillIds,
    disabledBuiltinSkillIds,
    mcpIds,
  };
};
