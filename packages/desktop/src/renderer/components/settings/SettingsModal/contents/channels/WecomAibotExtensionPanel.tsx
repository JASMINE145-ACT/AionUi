/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IChannelPluginStatus } from '@/common/types/channel/channel';
import { channel } from '@/common/adapter/ipcBridge';
import { configService } from '@/common/config/configService';
import { getAgents } from '@/renderer/hooks/agent/useAgents';
import { openExternalUrl } from '@/renderer/utils/platform';
import {
  isSupportedNewConversationAgent,
  normalizeSupportedAgentSelection,
} from '@/renderer/utils/model/agentTypeSupportPolicy';
import { Button, Dropdown, Input, Menu, Message, Switch } from '@arco-design/web-react';
import { CheckOne, Caution, Down, LinkOne } from '@icon-park/react';
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

const WecomAibotExtensionPanel: React.FC<WecomAibotExtensionPanelProps> = ({
  status,
  fields,
  values,
  onFieldChange,
}) => {
  const { t } = useTranslation();
  const [availableAgents, setAvailableAgents] = useState<
    Array<{ agent_type: string; backend?: string; name: string; id?: string }>
  >([]);
  const [selectedAgent, setSelectedAgent] = useState<{
    agent_type: string;
    backend?: string;
    id?: string;
    name?: string;
  }>({ agent_type: 'aionrs', name: 'Aion CLI' });

  useEffect(() => {
    const loadAgentsAndSelection = async () => {
      try {
        const [agentsResp, saved] = await Promise.all([getAgents(), configService.get('assistant.wecom.agent')]);

        if (Array.isArray(agentsResp)) {
          setAvailableAgents(
            agentsResp.filter(isSupportedNewConversationAgent).map((a) => ({
              agent_type: a.agent_type,
              backend: a.backend,
              name: a.name,
              id: a.id,
            }))
          );
        }

        if (saved && typeof saved === 'object') {
          const s = saved as Record<string, unknown>;
          const normalized = normalizeSupportedAgentSelection(
            typeof s.agent_type === 'string' ? s.agent_type : undefined,
            typeof s.backend === 'string' ? s.backend : undefined
          );
          if (normalized) {
            setSelectedAgent({
              ...normalized,
              id: (s.id as string | undefined) ?? (s.custom_agent_id as string | undefined),
              name: s.name as string | undefined,
            });
          }
        }
      } catch (error) {
        console.error('[WecomAibot] Failed to load agents:', error);
      }
    };

    void loadAgentsAndSelection();
  }, []);

  const persistSelectedAgent = async (agent: {
    agent_type: string;
    backend?: string;
    id?: string;
    name?: string;
  }) => {
    const payload = {
      agent_type: agent.agent_type,
      backend: agent.backend,
      id: agent.id,
      custom_agent_id: agent.id,
      name: agent.name,
    };
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
    if (status.connected) {
      return t('settings.channels.wecomAibot.connected', { defaultValue: 'Connected' });
    }
    if (status.enabled) {
      return status.status || t('settings.channels.wecomAibot.disconnected', { defaultValue: 'Disconnected' });
    }
    return t('settings.channels.wecomAibot.disabled', { defaultValue: 'Disabled' });
  }, [status.connected, status.enabled, status.status, t]);

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

  const agentOptions =
    availableAgents.length > 0 ? availableAgents : [{ agent_type: 'aionrs', name: 'Aion CLI' }];

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
                const agent = agentOptions.find((a) => `${a.agent_type}:${a.backend || ''}:${a.id || ''}` === key);
                if (!agent) return;
                setSelectedAgent(agent);
                void persistSelectedAgent(agent);
              }}
            >
              {agentOptions.map((agent) => {
                const key = `${agent.agent_type}:${agent.backend || ''}:${agent.id || ''}`;
                return <Menu.Item key={key}>{agent.name || agent.backend || agent.agent_type}</Menu.Item>;
              })}
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
