/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { CcbAgentRecord } from '@/common/config/ccbAgents';
import {
  CCB_DEFAULT_SESSION_AGENT_ID,
  filterGuidCatalogAgents,
  sortCcbAgents,
} from '@/common/config/ccbAgentCatalog';
import AgentCard from '@/renderer/pages/settings/AgentSettings/AgentCard';
import type { AgentMetadata } from '@/renderer/utils/model/agentTypes';
import { Typography } from '@arco-design/web-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';

function ccbAgentToMetadata(agent: CcbAgentRecord): AgentMetadata {
  const displayName = agent.display_name?.trim() || agent.name;
  return {
    id: agent.id,
    name: displayName,
    agent_type: 'acp',
    backend: 'claude',
    agent_source: agent.source === 'bundled' ? 'builtin' : 'custom',
    enabled: agent.enabled !== false,
    available: true,
    icon: agent.avatar,
    description: agent.description,
  };
}

export function resolveCcbAgentGuidSelectionKey(agent: CcbAgentRecord): string {
  if (agent.id === CCB_DEFAULT_SESSION_AGENT_ID) return 'claude';
  if (filterGuidCatalogAgents([agent]).length > 0) return `custom:${agent.id}`;
  return 'claude';
}

const CcbWandingAgentsPanel: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: agents, isLoading } = useSWR('ccb.agents.settings', () =>
    ipcBridge.ccbAgentsService.listAgents.invoke()
  );

  const sortedAgents = useMemo(() => sortCcbAgents(agents ?? []), [agents]);

  const goToChatWithAgent = (agent: CcbAgentRecord) => {
    navigate('/guid', { state: { selectedAgentKey: resolveCcbAgentGuidSelectionKey(agent) } });
  };

  return (
    <div className='flex flex-col gap-8px py-16px'>
      <div className='px-16px text-12px text-t-secondary'>
        {t('settings.ccbWandingAgentsDescription', {
          defaultValue: 'Agent 由 CCB-Wanding 安装目录管理，此处仅展示 WanD 预设与路由 Agent。',
        })}
      </div>

      <div className='px-16px mt-8px'>
        <Typography.Text className='text-12px font-medium text-t-secondary mb-4px block'>
          {t('settings.agentManagement.ccbWandingAgents', { defaultValue: 'CCB-Wanding Agents' })}
        </Typography.Text>
      </div>

      {isLoading ? (
        <Typography.Text type='secondary' className='block px-16px py-16px text-center text-12px'>
          {t('common.loading', { defaultValue: '加载中…' })}
        </Typography.Text>
      ) : sortedAgents.length === 0 ? (
        <Typography.Text type='secondary' className='block px-16px py-16px text-center text-12px'>
          {t('settings.agentManagement.localAgentsEmpty')}
        </Typography.Text>
      ) : (
        <div className='grid grid-cols-2 gap-10px px-16px md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
          {sortedAgents.map((agent) => {
            const metadata = ccbAgentToMetadata(agent);
            return (
              <AgentCard
                key={agent.id}
                type='detected'
                agent={metadata}
                onGoToChat={() => goToChatWithAgent(agent)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CcbWandingAgentsPanel;
