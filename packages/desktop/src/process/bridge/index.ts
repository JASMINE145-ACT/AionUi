/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { initApplicationBridge } from './applicationBridge';
import { initDialogBridge } from './dialogBridge';
import { initUpdateBridge } from './updateBridge';
import { initSystemSettingsBridge } from './systemSettingsBridge';
import { initWindowControlsBridge } from './windowControlsBridge';
import { initAppBadgeBridge } from './appBadgeBridge';
import { initNotificationBridge } from './notificationBridge';
import { initWebuiBridge } from './webuiBridge';
import { initThemeBridge } from './themeBridge';
import { initCcbAgentsBridge } from './ccbAgentsBridge';
import { initCcbAssistantProfilesBridge } from './ccbAssistantProfilesBridge';
import { initCcbEmployeeProfileBridge } from './ccbEmployeeProfileBridge';
import { initCcbPersonalMemoryBridge } from './ccbPersonalMemoryBridge';
import { initCcbPrecipitationBridge } from './ccbPrecipitationBridge';
import { initCcbMcpBridge } from './ccbMcpBridge';
import { initCcbModelBridge } from './ccbModelBridge';
import { initCcbSkillsBridge } from './ccbSkillsBridge';
import { initCcbUpdateBridge } from './ccbUpdateBridge';
import './orgServerBridge';

export type BridgeDependencies = Record<string, never>;

export function initAllBridges(_deps: BridgeDependencies = {}): void {
  initDialogBridge();
  initApplicationBridge();
  initWindowControlsBridge();
  initUpdateBridge();
  initSystemSettingsBridge();
  initNotificationBridge();
  initAppBadgeBridge();
  initWebuiBridge();
  initThemeBridge();
  initCcbModelBridge();
  initCcbMcpBridge();
  initCcbAgentsBridge();
  initCcbAssistantProfilesBridge();
  initCcbEmployeeProfileBridge();
  initCcbPersonalMemoryBridge();
  initCcbPrecipitationBridge();
  initCcbSkillsBridge();
  initCcbUpdateBridge();
}

export {
  initApplicationBridge,
  initDialogBridge,
  initAppBadgeBridge,
  initNotificationBridge,
  initSystemSettingsBridge,
  initThemeBridge,
  initUpdateBridge,
  initWindowControlsBridge,
  initWebuiBridge,
};
export { registerWindowMaximizeListeners } from './windowControlsBridge';
export const disposeAllTeamSessions = (): Promise<void> => Promise.resolve();
