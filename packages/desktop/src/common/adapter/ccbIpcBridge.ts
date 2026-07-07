/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * CCB-Wanding electron IPC bridge providers (main ↔ renderer).
 * Restored after accidental git restore removed uncommitted ipcBridge exports.
 */

import { bridge } from '@office-ai/platform';
import type { CcbAgentInput, CcbAgentRecord } from '../config/ccbAgents';
import type { CcbAssistantProfile, CcbAssistantProfileInput } from '../config/ccbAssistantProfiles';
import type { CcbMcpHealthRepairResult, CcbMcpHealthReport } from '../config/ccbMcpHealth';
import type { CcbStartupReadinessStatus } from '../config/ccbStartupReadinessShared';
import type { CcbMcpHealthRepairActionId } from '../config/ccbMcpHealthDiagnosis';
import type { CcbModelInfo } from '../config/ccbModelSettingsShared';
import type { CcbContinuitySnapshot, KnowledgeContinuityState } from '../config/ccbContinuitySnapshotShared';
import type { CcbSkillImportResult, CcbSkillInfo, CcbSkillPaths } from '../config/ccbSkillsShared';
import type { CcbSkillSyncResult } from '../config/ccbSkillsSyncShared';
import type { IMcpServer } from '../config/storage';
import type { CcbUpdateApplyResult, CcbUpdateCheckResult } from '../update/updateTypes';
import type { EmployeeProfile } from '../config/employeeProfileShared';
import type { CcbPersonalMemoryLearningStatus } from '../config/ccbPersonalMemoryLearning';
import type { MemoryFileContent, MemoryFileSummary, MemoryScope } from '../config/ccbMemoryFiles';

export const ccbModelService = {
  isAuthorityActive: bridge.buildProvider<boolean, void>('ccb.model.isAuthorityActive'),
  getModelInfo: bridge.buildProvider<CcbModelInfo | null, void>('ccb.model.getModelInfo'),
  getContinuitySnapshot: bridge.buildProvider<CcbContinuitySnapshot | null, void>(
    'ccb.model.getContinuitySnapshot'
  ),
  syncKnowledgeContinuity: bridge.buildProvider<
    void,
    { conversation_id: string; state: KnowledgeContinuityState; session_id?: string }
  >('ccb.model.syncKnowledgeContinuity'),
  stageConversationIdentity: bridge.buildProvider<void, { conversation_id: string }>(
    'ccb.model.stageConversationIdentity',
  ),
};

export const ccbMcpService = {
  isAuthorityActive: bridge.buildProvider<boolean, void>('ccb.mcp.isAuthorityActive'),
  listServers: bridge.buildProvider<IMcpServer[], { test?: boolean }>('ccb.mcp.listServers'),
  createServer: bridge.buildProvider<IMcpServer, IMcpServer>('ccb.mcp.createServer'),
  updateServer: bridge.buildProvider<
    IMcpServer,
    { id: string; data: Partial<IMcpServer>; previousName?: string }
  >('ccb.mcp.updateServer'),
  deleteServer: bridge.buildProvider<void, { id: string }>('ccb.mcp.deleteServer'),
  toggleServer: bridge.buildProvider<IMcpServer, { id: string }>('ccb.mcp.toggleServer'),
  importServers: bridge.buildProvider<IMcpServer[], { servers: IMcpServer[] }>('ccb.mcp.importServers'),
  testConnection: bridge.buildProvider<{ success: boolean; message?: string }, { name: string }>(
    'ccb.mcp.testConnection'
  ),
  runHealthCheck: bridge.buildProvider<CcbMcpHealthReport, { probe?: boolean; session?: boolean }>(
    'ccb.mcp.runHealthCheck'
  ),
  repairHealth: bridge.buildProvider<CcbMcpHealthRepairResult, { actionIds?: CcbMcpHealthRepairActionId[] }>(
    'ccb.mcp.repairHealth'
  ),
  getStartupReadiness: bridge.buildProvider<CcbStartupReadinessStatus, void>('ccb.mcp.getStartupReadiness'),
  ensureStartupReadiness: bridge.buildProvider<CcbStartupReadinessStatus, void>('ccb.mcp.ensureStartupReadiness'),
};

export const ccbAgentsService = {
  listAgents: bridge.buildProvider<CcbAgentRecord[], void>('ccb.agents.listAgents'),
  getAgent: bridge.buildProvider<CcbAgentRecord | null, { id: string }>('ccb.agents.getAgent'),
  saveAgent: bridge.buildProvider<CcbAgentRecord, CcbAgentInput>('ccb.agents.saveAgent'),
  deleteAgent: bridge.buildProvider<void, { id: string }>('ccb.agents.deleteAgent'),
  stageNextSessionAgent: bridge.buildProvider<void, { agent_id: string }>('ccb.agents.stageNextSessionAgent'),
};

export const ccbAssistantProfilesService = {
  listProfiles: bridge.buildProvider<CcbAssistantProfile[], void>('ccb.assistantProfiles.listProfiles'),
  getProfile: bridge.buildProvider<CcbAssistantProfile | null, { id: string }>('ccb.assistantProfiles.getProfile'),
  saveProfile: bridge.buildProvider<CcbAssistantProfile, CcbAssistantProfileInput>(
    'ccb.assistantProfiles.saveProfile'
  ),
  deleteProfile: bridge.buildProvider<void, { id: string }>('ccb.assistantProfiles.deleteProfile'),
  stageNextSessionProfile: bridge.buildProvider<void, { profile_id: string }>(
    'ccb.assistantProfiles.stageNextSessionProfile'
  ),
};

export const ccbSkillsService = {
  listSkills: bridge.buildProvider<CcbSkillInfo[], void>('ccb.skills.listSkills'),
  getPaths: bridge.buildProvider<CcbSkillPaths, void>('ccb.skills.getPaths'),
  importSkill: bridge.buildProvider<CcbSkillImportResult, { skillPath: string }>('ccb.skills.importSkill'),
  deleteSkill: bridge.buildProvider<void, { skillName: string }>('ccb.skills.deleteSkill'),
  syncFromAionUi: bridge.buildProvider<CcbSkillSyncResult, void>('ccb.skills.syncFromAionUi'),
};

export const ccbUpdate = {
  check: bridge.buildProvider<
    { success: boolean; data?: CcbUpdateCheckResult; msg?: string },
    { channel?: 'stable' | 'dev' }
  >('ccb.update.check'),
  getInstalledVersion: bridge.buildProvider<
    { success: boolean; data?: { version: string | null }; msg?: string },
    void
  >('ccb.update.getInstalledVersion'),
  apply: bridge.buildProvider<
    { success: boolean; data?: CcbUpdateApplyResult; msg?: string },
    void
  >('ccb.update.apply'),
};

export const ccbEmployeeProfileService = {
  syncProfile: bridge.buildProvider<void, { profile: EmployeeProfile | null }>(
    'ccb.employeeProfile.syncProfile'
  ),
};

export const ccbPersonalMemoryService = {
  getLearningStatus: bridge.buildProvider<CcbPersonalMemoryLearningStatus, void>(
    'ccb.personalMemory.getLearningStatus'
  ),
  listFiles: bridge.buildProvider<MemoryFileSummary[], { scope: MemoryScope }>(
    'ccb.personalMemory.listFiles'
  ),
  readFile: bridge.buildProvider<MemoryFileContent | null, { relPath: string }>(
    'ccb.personalMemory.readFile'
  ),
  writeFile: bridge.buildProvider<MemoryFileContent, { relPath: string; content: string }>(
    'ccb.personalMemory.writeFile'
  ),
};
