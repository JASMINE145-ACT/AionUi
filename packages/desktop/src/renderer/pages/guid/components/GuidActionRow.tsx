/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IMcpServer } from '@/common/config/storage';
import AgentModeSelector from '@/renderer/components/agent/AgentModeSelector';
import { supportsModeSwitch, type AgentModeOption } from '@/renderer/utils/model/agentModes';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { getCleanFileNames, FileService } from '@/renderer/services/FileService';
import { iconColors } from '@/renderer/styles/colors';
import { isElectronDesktop } from '@/renderer/utils/platform';
import type { AvailableAgent } from '../types';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import type { GuidCapabilitiesSource } from '../utils/guidCapabilitiesCatalog';
import PresetAgentTag, { type AgentSwitcherItem } from './PresetAgentTag';
import { Button, Checkbox, Dropdown, Menu, Message, Tooltip } from '@arco-design/web-react';
import { ArrowUp, Lightning, Plus, Shield, UploadOne } from '@icon-park/react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import styles from '../index.module.css';

type GuidActionRowProps = {
  // File handling
  files: string[];
  onFilesUploaded: (paths: string[]) => void;

  // Model selector node (rendered by parent)
  modelSelectorNode: React.ReactNode;

  // Agent mode
  selectedAgent: string | 'custom';
  effectiveModeAgent?: string;
  selectedMode: string;
  onModeSelect: (mode: string) => void;

  // Preset agent tag
  is_presetAgent: boolean;
  selectedAgentInfo: AvailableAgent | undefined;
  /**
   * Backend-merged preset catalog — drives the preset tag label lookup. Not
   * the ACP engine-config list (custom agents from the AgentRegistry).
   */
  assistants: Assistant[];
  localeKey: string;
  onClosePresetTag: () => void;
  agentLogo?: string | null;
  agentSwitcherItems?: AgentSwitcherItem[];
  onAgentSwitch?: (key: string) => void;
  hidePresetTag?: boolean;

  // Skills management
  allSkills: Array<{ name: string; description: string; isAuto: boolean }>;
  disabledBuiltinSkills: string[];
  enabledSkills: string[];
  onToggleSkill: (name: string, isAuto: boolean) => void;
  capabilitiesSource?: GuidCapabilitiesSource;
  skillsReadOnly?: boolean;
  mcpServers: IMcpServer[];
  selectedMcpServerIds: string[];
  sessionMcpServerIds?: string[];
  sessionSkillNames?: string[];
  sessionCcbAgentId?: string;
  onToggleMcpServer: (serverId: string) => void;

  // Send button
  loading: boolean;
  isButtonDisabled: boolean;
  speechInputNode?: React.ReactNode;
  onSend: () => void;
};

const GuidActionRow: React.FC<GuidActionRowProps> = ({
  files,
  onFilesUploaded,
  modelSelectorNode,
  selectedAgent,
  effectiveModeAgent,
  selectedMode,
  onModeSelect,
  is_presetAgent,
  selectedAgentInfo,
  assistants,
  localeKey,
  onClosePresetTag,
  agentLogo,
  agentSwitcherItems,
  onAgentSwitch,
  allSkills,
  disabledBuiltinSkills,
  enabledSkills,
  onToggleSkill,
  capabilitiesSource = 'aionui',
  skillsReadOnly = false,
  mcpServers,
  selectedMcpServerIds,
  sessionMcpServerIds,
  sessionSkillNames,
  sessionCcbAgentId,
  onToggleMcpServer,
  hidePresetTag = false,
  loading,
  isButtonDisabled,
  speechInputNode,
  onSend,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const [isPlusDropdownOpen, setIsPlusDropdownOpen] = useState(false);
  const modeBackend = effectiveModeAgent || selectedAgent;
  const showModeSwitch = supportsModeSwitch(modeBackend);
  const configOptionCount = (modelSelectorNode ? 1 : 0) + (showModeSwitch ? 1 : 0);
  const isCcbCapabilities = capabilitiesSource === 'ccb';

  const openMcpSettings = useCallback(() => {
    navigate('/settings/capabilities?tab=tools');
  }, [navigate]);

  const openSkillsSettings = useCallback(() => {
    navigate('/settings/capabilities?tab=skills');
  }, [navigate]);

  const openAgentSettings = useCallback(() => {
    const agentId = sessionCcbAgentId?.trim();
    navigate(
      agentId ? `/settings/assistants?highlight=${encodeURIComponent(agentId)}` : '/settings/assistants'
    );
  }, [navigate, sessionCcbAgentId]);

  // Browser file picker ref (WebUI only)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleLocalFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;
      setUploading(true);
      try {
        const processed = await FileService.processDroppedFiles(fileList);
        if (processed.length > 0) {
          onFilesUploaded(processed.map((f) => f.path));
        }
      } catch {
        Message.error(t('common.fileAttach.failed'));
      } finally {
        setUploading(false);
      }
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [onFilesUploaded, t]
  );

  const getModeDisplayLabel = (mode: AgentModeOption): string =>
    t(`agentMode.${mode.value}`, { defaultValue: mode.label });

  const isWebUI = !isElectronDesktop();

  const isSkillChecked = (skill: { name: string; isAuto: boolean }) =>
    isCcbCapabilities
      ? (sessionSkillNames?.some((name) => name.toLowerCase() === skill.name.toLowerCase()) ?? false)
      : skill.isAuto
        ? !disabledBuiltinSkills.includes(skill.name)
        : enabledSkills.includes(skill.name);

  const activeSkillCount = isCcbCapabilities
    ? (sessionSkillNames?.length ?? 0)
    : allSkills.filter(isSkillChecked).length;
  const activeMcpCount = isCcbCapabilities
    ? (sessionMcpServerIds?.length ?? 0)
    : selectedMcpServerIds.length;

  const skillsMenuTitle = isCcbCapabilities
    ? t('conversation.welcome.ccbSkillsSessionMenu', { defaultValue: '本会话技能' })
    : t('settings.capabilitiesTab.skills');
  const skillsMenuCount = isCcbCapabilities
    ? activeSkillCount > 0
      ? `（${activeSkillCount}）`
      : ''
    : `(${activeSkillCount}/${allSkills.length})`;
  const mcpMenuTitle = isCcbCapabilities
    ? t('conversation.welcome.ccbMcpSessionMenu', { defaultValue: '本会话 MCP' })
    : t('mcp.label');
  const mcpMenuCount = isCcbCapabilities
    ? activeMcpCount > 0
      ? `（${activeMcpCount}）`
      : ''
    : `(${activeMcpCount}/${mcpServers.length})`;

  const menuContent = (
    <Menu
      className='min-w-200px'
      onClickMenuItem={(key) => {
        if (key === 'file') {
          ipcBridge.dialog.showOpen
            .invoke({ properties: ['openFile', 'multiSelections'] })
            .then((uploadedFiles) => {
              if (uploadedFiles && uploadedFiles.length > 0) {
                onFilesUploaded(uploadedFiles);
              }
            })
            .catch((error) => {
              console.error('Failed to open file dialog:', error);
            });
        } else if (key === 'device') {
          fileInputRef.current?.click();
        } else if (key === 'ccb-open-mcp-settings') {
          openMcpSettings();
        } else if (key === 'ccb-open-skills-settings') {
          openSkillsSettings();
        } else if (key === 'ccb-open-agent-settings') {
          openAgentSettings();
        }
      }}
    >
      {isWebUI ? (
        <>
          <Menu.Item key='file'>
            <div className='flex items-center gap-8px'>
              <UploadOne theme='outline' size='16' fill={iconColors.secondary} style={{ lineHeight: 0 }} />
              <span>{t('common.fileAttach.addFiles')}</span>
            </div>
          </Menu.Item>
          <Menu.Item key='device'>
            <div className='flex items-center gap-8px'>
              <UploadOne theme='outline' size='16' fill={iconColors.secondary} style={{ lineHeight: 0 }} />
              <span>{t('common.fileAttach.myDevice')}</span>
            </div>
          </Menu.Item>
        </>
      ) : (
        <Menu.Item key='file'>
          <div className='flex items-center gap-8px'>
            <UploadOne theme='outline' size='16' fill={iconColors.secondary} style={{ lineHeight: 0 }} />
            <span>{t('common.fileAttach.addFiles')}</span>
          </div>
        </Menu.Item>
      )}
      {allSkills.length > 0 || isCcbCapabilities ? (
        <Menu.SubMenu
          key='skills'
          title={
            <div className='flex items-center gap-8px'>
              <Lightning theme='filled' size='16' fill={iconColors.primary} style={{ lineHeight: 0 }} />
              <span>
                {skillsMenuTitle} {skillsMenuCount}
              </span>
            </div>
          }
          triggerProps={{
            popupStyle: {
              maxHeight: 360,
              overflowY: 'auto',
              overflowX: 'hidden',
            },
          }}
        >
          {isCcbCapabilities ? (
            <>
              {(sessionSkillNames?.length ?? 0) === 0 ? (
                <Menu.Item key='skills-session-empty' disabled className='!cursor-default'>
                  <span className='text-13px text-t-secondary'>
                    {t('conversation.welcome.ccbSkillsSessionEmptyShort', {
                      defaultValue: '当前 Agent 未启用技能',
                    })}
                  </span>
                </Menu.Item>
              ) : (
                sessionSkillNames!.map((name) => (
                  <Menu.Item
                    key={`skill-session-${name}`}
                    disabled
                    className='!cursor-default'
                  >
                    <span className='text-13px'>{name}</span>
                  </Menu.Item>
                ))
              )}
              <Menu.Item key='ccb-open-skills-settings'>
                <span className='text-13px text-t-secondary'>
                  {t('conversation.welcome.ccbOpenSkillsSettings', {
                    defaultValue: '管理技能安装 → 设置',
                  })}
                </span>
              </Menu.Item>
              <Menu.Item key='ccb-open-agent-settings'>
                <span className='text-13px text-t-secondary'>
                  {t('conversation.welcome.ccbOpenAgentSettings', {
                    defaultValue: '配置本会话 Agent → 助手',
                  })}
                </span>
              </Menu.Item>
            </>
          ) : allSkills.length === 0 ? (
            <Menu.Item key='skills-empty' disabled>
              <span className='text-13px text-t-secondary'>
                {t('conversation.welcome.ccbSkillsEmpty', {
                  defaultValue: 'No CCB-Wanding skills yet. Import them in Settings → Skills Hub.',
                })}
              </span>
            </Menu.Item>
          ) : (
            allSkills.map((skill) => (
              <Menu.Item
                key={`skill-${skill.name}`}
                disabled={skillsReadOnly}
                onClick={(e) => {
                  if (skillsReadOnly) return;
                  e.stopPropagation();
                  onToggleSkill(skill.name, skill.isAuto);
                }}
              >
                <Checkbox
                  checked={isSkillChecked(skill)}
                  disabled={skillsReadOnly}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  onChange={() => {
                    if (!skillsReadOnly) onToggleSkill(skill.name, skill.isAuto);
                  }}
                >
                  <span className='text-13px'>{skill.name}</span>
                </Checkbox>
              </Menu.Item>
            ))
          )}
        </Menu.SubMenu>
      ) : null}
      {mcpServers.length > 0 || isCcbCapabilities ? (
        <Menu.SubMenu
          key='mcp'
          title={
            <div className='flex items-center gap-8px'>
              <Shield theme='outline' size='16' fill={iconColors.primary} style={{ lineHeight: 0 }} />
              <span>
                {mcpMenuTitle}
                {mcpMenuCount}
              </span>
            </div>
          }
          triggerProps={{
            popupStyle: {
              maxHeight: 360,
              overflowY: 'auto',
              overflowX: 'hidden',
            },
          }}
        >
          {isCcbCapabilities ? (
            <>
              {(sessionMcpServerIds?.length ?? 0) === 0 ? (
                <Menu.Item key='mcp-session-empty' disabled className='!cursor-default'>
                  <span className='text-13px text-t-secondary'>
                    {t('conversation.welcome.ccbMcpSessionEmptyShort', {
                      defaultValue: '当前 Agent 无直接 MCP（全局路由将自动委派子助手）',
                    })}
                  </span>
                </Menu.Item>
              ) : (
                mcpServers
                  .filter((server) => sessionMcpServerIds?.includes(server.id))
                  .map((server) => (
                    <Menu.Item key={`mcp-session-${server.id}`} disabled className='!cursor-default'>
                      <span className='text-13px'>{server.name}</span>
                    </Menu.Item>
                  ))
              )}
              <Menu.Item key='ccb-open-mcp-settings'>
                <span className='text-13px text-t-secondary'>
                  {t('conversation.welcome.ccbOpenMcpSettings', {
                    defaultValue: '管理 MCP → 设置',
                  })}
                </span>
              </Menu.Item>
            </>
          ) : (
            mcpServers.map((server) => (
              <Menu.Item
                key={`mcp-${server.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMcpServer(server.id);
                }}
              >
                <Checkbox
                  checked={selectedMcpServerIds.includes(server.id)}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  onChange={() => onToggleMcpServer(server.id)}
                >
                  <span className='text-13px'>
                    {server.name}
                    {server.tools?.length ? ` (${server.tools.length} ${t('mcp.tools')})` : ''}
                  </span>
                </Checkbox>
              </Menu.Item>
            ))
          )}
        </Menu.SubMenu>
      ) : null}
    </Menu>
  );

  return (
    <div className={styles.actionRow}>
      <div className={styles.actionTools}>
        <div className={styles.actionEntry}>
          <Dropdown trigger='hover' onVisibleChange={setIsPlusDropdownOpen} droplist={menuContent}>
            <span className='flex items-center gap-4px cursor-pointer lh-[1]'>
              <Button
                type='secondary'
                shape='circle'
                className={isPlusDropdownOpen ? styles.plusButtonRotate : ''}
                icon={<Plus theme='outline' size='14' strokeWidth={2} fill={iconColors.primary} />}
                loading={uploading}
                disabled={uploading}
                data-testid='file-upload-btn'
              />
              {files.length > 0 && (
                <Tooltip
                  className={'!max-w-max'}
                  content={<span className='whitespace-break-spaces'>{getCleanFileNames(files).join('\n')}</span>}
                >
                  <span className='text-t-primary'>File({files.length})</span>
                </Tooltip>
              )}
            </span>
          </Dropdown>
          {isWebUI && (
            <input
              ref={fileInputRef}
              type='file'
              multiple
              style={{ display: 'none' }}
              onChange={handleLocalFileChange}
            />
          )}
        </div>
      </div>
      <div className={styles.actionSubmit}>
        {configOptionCount > 0 && (
          <div className={styles.actionConfigGroup} data-mobile={isMobile ? 'true' : undefined}>
            {modelSelectorNode}

            {showModeSwitch && (
              <AgentModeSelector
                backend={modeBackend}
                compact
                initialMode={selectedMode}
                onModeSelect={onModeSelect}
                compactLeadingIcon={<Shield theme='outline' size='14' fill={iconColors.secondary} />}
                modeLabelFormatter={getModeDisplayLabel}
              />
            )}
          </div>
        )}

        {!hidePresetTag && is_presetAgent && selectedAgentInfo && (
          <div className={styles.actionPresetAgent}>
            <PresetAgentTag
              agentInfo={selectedAgentInfo}
              assistants={assistants}
              localeKey={localeKey}
              onClose={onClosePresetTag}
              agentLogo={agentLogo}
              agentSwitcherItems={agentSwitcherItems}
              onAgentSwitch={onAgentSwitch}
            />
          </div>
        )}

        {speechInputNode}
        <Button
          shape='circle'
          type='primary'
          loading={loading}
          disabled={isButtonDisabled}
          className='send-button-custom'
          style={{
            backgroundColor: isButtonDisabled ? undefined : '#000000',
            borderColor: isButtonDisabled ? undefined : '#000000',
          }}
          icon={<ArrowUp theme='filled' size='14' fill='white' strokeWidth={5} />}
          onClick={onSend}
          data-testid='guid-send-btn'
        />
      </div>
    </div>
  );
};

export default GuidActionRow;
