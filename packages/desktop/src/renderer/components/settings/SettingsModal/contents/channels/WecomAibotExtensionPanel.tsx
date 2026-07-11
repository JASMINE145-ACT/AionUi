/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IChannelPairingRequest, IChannelPluginStatus, IChannelUser } from '@/common/types/channel/channel';
import { channel } from '@/common/adapter/ipcBridge';
import { configService } from '@/common/config/configService';
import { openExternalUrl } from '@/renderer/utils/platform';
import {
  channelAgentOptionKey,
  channelAgentOptionToPersistPayload,
  loadChannelAgentOptions,
  matchSavedChannelAgent,
  type ChannelAgentOption,
} from './channelAgentOptions';
import { Button, Dropdown, Empty, Input, Menu, Message, Spin, Switch, Tooltip } from '@arco-design/web-react';
import { CheckOne, Caution, CloseOne, Copy, Down, LinkOne, Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type FieldValues = Record<string, string | number | boolean>;

type ExtensionFieldSchema = {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'number' | 'boolean';
  required?: boolean;
  options?: string[];
  default?: string | number | boolean;
};

interface WecomAibotExtensionPanelProps {
  status: IChannelPluginStatus;
  fields: ExtensionFieldSchema[];
  values: FieldValues;
  onFieldChange: (key: string, value: string | number | boolean) => void;
}

const WECOM_DEV_DOCS_URL = 'https://developer.work.weixin.qq.com/document/path/101463';
const WECOM_AIBOT_PLATFORM_TYPES = new Set(['ext-wecom-aibot', 'wecom']);

const isWecomAibotPlatform = (platformType: string) => WECOM_AIBOT_PLATFORM_TYPES.has(platformType);

const SectionHeader: React.FC<{ title: string; action?: React.ReactNode }> = ({ title, action }) => (
  <div className='flex items-center justify-between mb-12px'>
    <h3 className='text-14px font-500 text-t-primary m-0'>{title}</h3>
    {action}
  </div>
);

const WecomAibotExtensionPanel: React.FC<WecomAibotExtensionPanelProps> = ({
  status,
  fields,
  values,
  onFieldChange,
}) => {
  const { t } = useTranslation();
  const [pairingLoading, setPairingLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [pendingPairings, setPendingPairings] = useState<IChannelPairingRequest[]>([]);
  const [authorizedUsers, setAuthorizedUsers] = useState<IChannelUser[]>([]);
  const [availableAgents, setAvailableAgents] = useState<ChannelAgentOption[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<ChannelAgentOption>({
    key: 'cli:aionrs::',
    agent_type: 'aionrs',
    name: 'Aion CLI',
    isPreset: false,
  });

  useEffect(() => {
    const loadAgentsAndSelection = async () => {
      try {
        const [options, saved] = await Promise.all([
          loadChannelAgentOptions(),
          configService.get('assistant.wecom.agent'),
        ]);

        setAvailableAgents(options);

        const matched =
          matchSavedChannelAgent(options, saved as Record<string, unknown> | undefined) ??
          options.find((o) => o.agent_type === 'aionrs' && !o.isPreset) ??
          options[0];
        if (matched) {
          setSelectedAgent(matched);
        }
      } catch (error) {
        console.error('[WecomAibot] Failed to load agents:', error);
      }
    };

    void loadAgentsAndSelection();
  }, []);

  const loadPendingPairings = useCallback(async () => {
    setPairingLoading(true);
    try {
      const pairings = await channel.getPendingPairings.invoke();
      if (pairings) {
        setPendingPairings(pairings.filter((p) => isWecomAibotPlatform(p.platformType)));
      }
    } catch (error) {
      console.error('[WecomAibot] Failed to load pending pairings:', error);
    } finally {
      setPairingLoading(false);
    }
  }, []);

  const loadAuthorizedUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const users = await channel.getAuthorizedUsers.invoke();
      if (users) {
        setAuthorizedUsers(users.filter((u) => isWecomAibotPlatform(u.platformType)));
      }
    } catch (error) {
      console.error('[WecomAibot] Failed to load authorized users:', error);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPendingPairings();
    void loadAuthorizedUsers();
  }, [loadPendingPairings, loadAuthorizedUsers]);

  useEffect(() => {
    const unsubscribe = channel.pairingRequested.on((request) => {
      if (!isWecomAibotPlatform(request.platformType)) return;
      setPendingPairings((prev) => {
        const exists = prev.some((p) => p.code === request.code);
        if (exists) return prev;
        return [request, ...prev];
      });
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = channel.userAuthorized.on((user) => {
      if (!isWecomAibotPlatform(user.platformType)) return;
      setAuthorizedUsers((prev) => {
        const exists = prev.some((u) => u.id === user.id);
        if (exists) return prev;
        return [user, ...prev];
      });
      setPendingPairings((prev) => prev.filter((p) => p.platformUserId !== user.platformUserId));
    });
    return () => unsubscribe();
  }, []);

  const handleApprovePairing = async (code: string) => {
    try {
      await channel.approvePairing.invoke({ code });
      Message.success(t('settings.assistant.pairingApproved', 'Pairing approved'));
      await loadPendingPairings();
      await loadAuthorizedUsers();
    } catch (error: unknown) {
      Message.error(error instanceof Error ? error.message : String(error));
    }
  };

  const handleRejectPairing = async (code: string) => {
    try {
      await channel.rejectPairing.invoke({ code });
      Message.info(t('settings.assistant.pairingRejected', 'Pairing rejected'));
      await loadPendingPairings();
    } catch (error: unknown) {
      Message.error(error instanceof Error ? error.message : String(error));
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    Message.success(t('common.copySuccess', 'Copied'));
  };

  const getRemainingTime = (expiresAt: number) => {
    const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000 / 60));
    return `${remaining} min`;
  };

  const persistSelectedAgent = async (agent: ChannelAgentOption) => {
    const payload = channelAgentOptionToPersistPayload(agent);
    try {
      await configService.set('assistant.wecom.agent', payload);
      await channel.syncChannelSettings
        .invoke({ platform: 'wecom' })
        .catch((err) => console.warn('[WecomAibot] syncChannelSettings failed:', err));
      Message.success(t('settings.assistant.agentSwitched', 'Agent switched successfully'));
    } catch (error) {
      console.error('[WecomAibot] Failed to save agent:', error);
      Message.error(t('common.saveFailed', 'Failed to save'));
    }
  };

  const connectionLabel = useMemo(() => {
    if (status.error) {
      return status.error;
    }
    if (status.status === 'error') {
      return t('settings.channels.wecomAibot.enableFailed', {
        defaultValue: 'Enable failed — check credentials and extension runtime',
      });
    }
    if (status.connected) {
      return t('settings.channels.wecomAibot.connected', { defaultValue: 'Connected' });
    }
    if (status.enabled) {
      return status.status || t('settings.channels.wecomAibot.disconnected', { defaultValue: 'Disconnected' });
    }
    return t('settings.channels.wecomAibot.disabled', { defaultValue: 'Disabled' });
  }, [status.connected, status.enabled, status.error, status.status, t]);

  const connectionTone = status.connected ? 'success' : status.enabled ? 'warning' : 'neutral';

  const setupSteps = [
    t('settings.channels.wecomAibot.stepCredentials', {
      defaultValue: 'Enter Bot ID and Secret from WeCom admin (long-connection mode).',
    }),
    t('settings.channels.wecomAibot.stepAgent', {
      defaultValue: 'Choose the agent that handles WeCom conversations (e.g. wande-orchestrator).',
    }),
    t('settings.channels.wecomAibot.stepEnable', {
      defaultValue: 'Enable the channel switch to start the WebSocket long connection.',
    }),
  ];

  const renderCredentialField = useCallback(
    (field: ExtensionFieldSchema) => {
      const rawValue = values[field.key];
      const label = `${field.label}${field.required ? ' *' : ''}`;
      const maskedPlaceholder =
        status.hasToken && (rawValue === undefined || rawValue === '')
          ? '••••••••••••••••'
          : field.label;

      if (field.type === 'boolean') {
        return (
          <div key={field.key} className='flex items-center justify-between py-8px'>
            <span className='text-13px text-t-primary'>{label}</span>
            <Switch checked={Boolean(rawValue)} onChange={(checked) => onFieldChange(field.key, checked)} />
          </div>
        );
      }

      return (
        <div key={field.key} className='space-y-6px'>
          <div className='text-13px text-t-primary'>{label}</div>
          <Input
            value={typeof rawValue === 'string' ? rawValue : ''}
            onChange={(value) => onFieldChange(field.key, value)}
            placeholder={maskedPlaceholder}
            type={field.type === 'password' ? 'password' : 'text'}
          />
          {status.hasToken && field.type === 'password' && !String(rawValue || '').trim() ? (
            <div className='text-12px text-t-tertiary'>
              {t('settings.channels.wecomAibot.savedSecretHint', {
                defaultValue: 'Secret is saved. Leave blank to keep the existing value when re-enabling.',
              })}
            </div>
          ) : null}
        </div>
      );
    },
    [onFieldChange, status.hasToken, t, values]
  );

  const credentialFields = fields.filter(
    (f) => (f.type === 'text' || f.type === 'password' || f.type === 'number') && f.key !== 'wsUrl'
  );
  const configFields = fields.filter((f) => f.type === 'boolean' || f.key === 'wsUrl');

  const presetAgentOptions = availableAgents.filter((agent) => agent.isPreset);
  const cliAgentOptions = availableAgents.filter((agent) => !agent.isPreset);
  const agentOptions =
    availableAgents.length > 0
      ? availableAgents
      : [
          {
            key: 'cli:aionrs::',
            agent_type: 'aionrs' as const,
            name: 'Aion CLI',
            isPreset: false,
          },
        ];

  return (
    <div className='space-y-12px py-4px' data-wecom-aibot-panel='true'>
      <div
        className='flex items-start gap-10px p-12px rd-10px border border-line bg-fill-1'
        data-wecom-aibot-connection-panel='true'
      >
        <div
          className={`shrink-0 w-32px h-32px rd-8px flex items-center justify-center ${
            connectionTone === 'success'
              ? 'bg-[rgba(var(--green-6),0.12)] text-[rgb(var(--green-6))]'
              : connectionTone === 'warning'
                ? 'bg-[rgba(var(--orange-6),0.12)] text-[rgb(var(--orange-6))]'
                : 'bg-[rgba(var(--gray-3),0.5)] text-t-secondary'
          }`}
        >
          {connectionTone === 'success' ? (
            <LinkOne theme='outline' size={18} />
          ) : (
            <Caution theme='outline' size={18} />
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <div className='text-14px font-500 text-t-primary'>
            {t('settings.channels.wecomAibot.connectionTitle', { defaultValue: 'Connection status' })}
          </div>
          <div className='text-13px text-t-secondary mt-4px'>
            {t('settings.channels.wecomAibot.connectionState', {
              defaultValue: 'State: {{state}}',
              state: connectionLabel,
            })}
          </div>
          {status.enabled && !status.connected ? (
            <div className='text-12px text-[rgb(var(--orange-6))] mt-6px leading-relaxed'>
              {t('settings.channels.wecomAibot.connectingHint', {
                defaultValue:
                  'Channel is enabled but not connected yet. Verify Bot ID / Secret and ensure the extension runtime is running.',
              })}
            </div>
          ) : null}
          {status.error ? <div className='text-12px text-[rgb(var(--red-6))] mt-4px'>{status.error}</div> : null}
        </div>
      </div>

      <div className='text-12px leading-relaxed p-10px rd-8px bg-[rgba(var(--primary-6),0.06)] border border-[rgba(var(--primary-6),0.2)] text-t-secondary'>
        <div className='font-500 text-t-primary mb-6px'>
          {t('settings.channels.wecomAibot.longConnTitle', { defaultValue: 'Long-connection mode' })}
        </div>
        <div>
          {t('settings.channels.wecomAibot.longConnDesc', {
            defaultValue: 'Uses Bot ID + Secret over WebSocket. No public callback URL required.',
          })}
        </div>
        <div className='mt-6px'>
          {t('settings.channels.wecomAibot.longConnScope', {
            defaultValue: 'v1: enterprise DM and group chat (mention @bot in groups).',
          })}
        </div>
        <Button
          type='text'
          size='mini'
          className='!px-0 mt-6px'
          icon={<LinkOne theme='outline' size={14} />}
          onClick={() => openExternalUrl(WECOM_DEV_DOCS_URL)}
        >
          {t('settings.channels.wecomAibot.openDocs', { defaultValue: 'WeCom developer docs' })}
        </Button>
      </div>

      <div className='space-y-6px'>
        <div className='text-13px font-500 text-t-primary'>
          {t('settings.channels.wecomAibot.setupTitle', { defaultValue: 'Setup' })}
        </div>
        <div className='flex flex-wrap gap-x-12px gap-y-6px'>
          {setupSteps.map((stepLabel, idx) => (
            <div key={stepLabel} className='inline-flex items-center gap-6px'>
              <span className='inline-flex items-center justify-center w-16px h-16px rd-50% text-10px font-600 bg-[rgba(var(--primary-6),0.12)] text-[rgb(var(--primary-6))]'>
                {idx + 1}
              </span>
              <CheckOne theme='outline' size='12' className='text-[rgb(var(--primary-6))]' />
              <span className='text-12px text-t-secondary'>{stepLabel}</span>
            </div>
          ))}
        </div>
      </div>

      <div className='space-y-10px'>
        <div className='text-13px font-500 text-t-primary'>
          {t('settings.channels.wecomAibot.credentialsTitle', { defaultValue: 'Credentials' })}
        </div>
        {status.hasToken ? (
          <div className='text-12px text-t-tertiary leading-relaxed'>
            {t('settings.channels.wecomAibot.credentialsSavedHint', {
              defaultValue:
                'Credentials are saved locally. Bot ID is shown below; Secret stays hidden — leave it blank when re-enabling to keep the stored value.',
            })}
          </div>
        ) : null}
        {credentialFields.map(renderCredentialField)}
      </div>

      <div className='space-y-8px py-8px border-t border-line'>
        <div className='text-13px font-500 text-t-primary'>
          {t('settings.wecom.agent', { defaultValue: 'Agent' })}
        </div>
        <div className='text-12px text-t-tertiary mb-4px'>
          {t('settings.wecom.agentDesc', { defaultValue: 'Used for WeCom conversations' })}
        </div>
        <Dropdown
          droplist={
            <Menu
              onClickMenuItem={(key) => {
                const agent = agentOptions.find((a) => channelAgentOptionKey(a) === key);
                if (!agent) return;
                setSelectedAgent(agent);
                void persistSelectedAgent(agent);
              }}
            >
              {presetAgentOptions.length > 0 ? (
                <Menu.ItemGroup
                  key='preset-agents'
                  title={t('settings.channels.wecomAibot.presetAgents', { defaultValue: 'WanD assistants' })}
                >
                  {presetAgentOptions.map((agent) => (
                    <Menu.Item key={channelAgentOptionKey(agent)}>
                      {agent.name || agent.custom_agent_id}
                    </Menu.Item>
                  ))}
                </Menu.ItemGroup>
              ) : null}
              {cliAgentOptions.length > 0 ? (
                <Menu.ItemGroup
                  key='cli-agents'
                  title={t('settings.channels.wecomAibot.cliAgents', { defaultValue: 'CLI runtimes' })}
                >
                  {cliAgentOptions.map((agent) => (
                    <Menu.Item key={channelAgentOptionKey(agent)}>
                      {agent.name || agent.backend || agent.agent_type}
                    </Menu.Item>
                  ))}
                </Menu.ItemGroup>
              ) : null}
            </Menu>
          }
          trigger='click'
        >
          <Button type='outline' size='small' className='rd-8px'>
            {selectedAgent.name || selectedAgent.backend || selectedAgent.agent_type}
            <Down theme='outline' size='14' className='ml-4px' />
          </Button>
        </Dropdown>
      </div>

      {(status.enabled || status.connected) && authorizedUsers.length === 0 ? (
        <div className='bg-fill-1 rd-12px p-16px border-t border-line'>
          <SectionHeader
            title={t('settings.assistant.pendingPairings', 'Pending Pairing Requests')}
            action={
              <Button
                size='mini'
                type='text'
                icon={<Refresh size={14} />}
                loading={pairingLoading}
                onClick={loadPendingPairings}
              >
                {t('conversation.workspace.refresh', 'Refresh')}
              </Button>
            }
          />
          <div className='text-12px text-t-tertiary mb-12px leading-relaxed'>
            {t('settings.channels.wecomAibot.pairingHint', {
              defaultValue:
                'When a user messages the bot for the first time, approve their pairing code here (same code shown in WeCom).',
            })}
          </div>
          {pairingLoading ? (
            <div className='flex justify-center py-24px'>
              <Spin />
            </div>
          ) : pendingPairings.length === 0 ? (
            <Empty description={t('settings.assistant.noPendingPairings', 'No pending pairing requests')} />
          ) : (
            <div className='flex flex-col gap-12px'>
              {pendingPairings.map((pairing) => (
                <div key={pairing.code} className='flex items-center justify-between bg-fill-2 rd-8px p-12px'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-8px'>
                      <span className='text-14px font-500 text-t-primary'>
                        {pairing.display_name || 'Unknown User'}
                      </span>
                      <Tooltip content={t('settings.assistant.copyCode', 'Copy pairing code')}>
                        <button
                          type='button'
                          className='p-4px bg-transparent border-none text-t-tertiary hover:text-t-primary cursor-pointer'
                          onClick={() => copyToClipboard(pairing.code)}
                        >
                          <Copy size={14} />
                        </button>
                      </Tooltip>
                    </div>
                    <div className='text-12px text-t-tertiary mt-4px'>
                      {t('settings.assistant.pairingCode', 'Code')}:{' '}
                      <code className='bg-fill-3 px-4px rd-2px'>{pairing.code}</code>
                      <span className='mx-8px'>|</span>
                      {t('settings.assistant.expiresIn', 'Expires in')}: {getRemainingTime(pairing.expiresAt)}
                    </div>
                  </div>
                  <div className='flex items-center gap-8px shrink-0 ml-8px'>
                    <Button
                      type='primary'
                      size='small'
                      icon={<CheckOne size={14} />}
                      onClick={() => handleApprovePairing(pairing.code)}
                    >
                      {t('settings.assistant.approve', 'Approve')}
                    </Button>
                    <Button
                      type='secondary'
                      size='small'
                      status='danger'
                      icon={<CloseOne size={14} />}
                      onClick={() => handleRejectPairing(pairing.code)}
                    >
                      {t('settings.assistant.reject', 'Reject')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {authorizedUsers.length > 0 ? (
        <div className='bg-fill-1 rd-12px p-16px border-t border-line'>
          <SectionHeader
            title={t('settings.assistant.authorizedUsers', 'Authorized Users')}
            action={
              <Button
                size='mini'
                type='text'
                icon={<Refresh size={14} />}
                loading={usersLoading}
                onClick={loadAuthorizedUsers}
              >
                {t('common.refresh', 'Refresh')}
              </Button>
            }
          />
          {usersLoading ? (
            <div className='flex justify-center py-24px'>
              <Spin />
            </div>
          ) : (
            <div className='flex flex-col gap-12px'>
              {authorizedUsers.map((user) => (
                <div key={user.id} className='flex items-center justify-between bg-fill-2 rd-8px p-12px'>
                  <div className='text-14px font-500 text-t-primary'>{user.display_name || 'Unknown User'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {configFields.length > 0 ? (
        <div className='space-y-8px pt-4px border-t border-line'>
          <div className='text-13px font-500 text-t-primary'>
            {t('settings.channels.wecomAibot.advancedTitle', { defaultValue: 'Advanced' })}
          </div>
          {configFields.map(renderCredentialField)}
        </div>
      ) : null}
    </div>
  );
};

export default WecomAibotExtensionPanel;
