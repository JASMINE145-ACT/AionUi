/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Collapse, Message, Tag, Tooltip } from '@arco-design/web-react';
import { Check, CloseSmall, Heartbeat, LoadingOne, Robot, Tool } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ccbMcpService } from '@/common/adapter/ipcBridge';
import type { CcbMcpHealthReport, CcbMcpHealthRepairResult } from '@/common/config/ccbMcpHealth';
import type { CcbMcpHealthDiagnosis, CcbMcpHealthRepairActionId } from '@/common/config/ccbMcpHealthDiagnosis';
import { buildMinimaxPromptForReport } from '@/common/config/ccbMcpHealthDiagnosis';
import { isCcbMcpAuthorityActive, resetCcbMcpAuthorityCache } from '@/renderer/hooks/mcp/ccbMcpAuthority';
import { iconColors } from '@/renderer/styles/colors';

type LayerKey = 'config' | 'probe';

const layerLabelKey: Record<LayerKey, string> = {
  config: 'settings.ccbMcpHealthLayerConfig',
  probe: 'settings.ccbMcpHealthLayerProbe',
};

const repairActionLabelKey: Record<CcbMcpHealthRepairActionId, string> = {
  'ensure-wanding-settings': 'settings.ccbMcpHealthActionEnsureSettings',
  'deploy-seed-agents': 'settings.ccbMcpHealthActionDeploySeeds',
  'repair-word-creator': 'settings.ccbMcpHealthActionRepairWord',
  'repair-excel-creator': 'settings.ccbMcpHealthActionRepairExcel',
  'repair-subagent-mcp': 'settings.ccbMcpHealthActionRepairSubagent',
};

const StatusDot: React.FC<{ ok?: boolean; loading?: boolean }> = ({ ok, loading }) => {
  if (loading) {
    return <LoadingOne fill={iconColors.primary} className='h-16px w-16px' />;
  }
  if (ok === true) {
    return <Check fill={iconColors.success} className='h-16px w-16px' />;
  }
  if (ok === false) {
    return <CloseSmall fill={iconColors.danger} className='h-16px w-16px' />;
  }
  return <span className='inline-block w-8px h-8px rounded-full bg-[var(--color-fill-3)]' />;
};

const HealthItemRow: React.FC<{ item: { id: string; detail: string; ok?: boolean } }> = ({ item }) => (
  <div className='flex items-start gap-8px py-4px text-12px leading-18px'>
    <StatusDot ok={item.ok} />
    <div className='min-w-0 flex-1'>
      <span className='text-t-primary font-mono'>{item.id}</span>
      <span className='text-t-secondary ml-6px'>{item.detail}</span>
    </div>
  </div>
);

const DiagnosisItemRow: React.FC<{
  item: CcbMcpHealthDiagnosis['items'][number];
  t: (key: string) => string;
}> = ({ item, t }) => (
  <div className='py-6px border-b border-border-2 last:border-b-0'>
    <div className='flex items-start gap-8px text-12px leading-18px'>
      <Tag size='small' color={item.severity === 'fixable' ? 'arcoblue' : 'orange'} className='shrink-0 mt-1px'>
        {item.severity === 'fixable'
          ? t('settings.ccbMcpHealthSeverityFixable')
          : t('settings.ccbMcpHealthSeverityManual')}
      </Tag>
      <div className='min-w-0 flex-1'>
        <div className='text-t-primary'>{item.title}</div>
        <div className='text-t-secondary mt-2px'>{item.detail}</div>
        {item.repair_action_ids.length > 0 ? (
          <div className='text-11px text-t-secondary mt-4px'>
            {t('settings.ccbMcpHealthSuggestedActions')}:{' '}
            {item.repair_action_ids.map((id) => t(repairActionLabelKey[id])).join(' · ')}
          </div>
        ) : null}
      </div>
    </div>
  </div>
);

type AuthorityState = 'loading' | 'active' | 'inactive' | 'error';

const CcbMcpHealthPanel: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [authorityState, setAuthorityState] = useState<AuthorityState>('loading');
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<CcbMcpHealthReport | null>(null);
  const [lastRepair, setLastRepair] = useState<CcbMcpHealthRepairResult | null>(null);

  useEffect(() => {
    resetCcbMcpAuthorityCache();
    void isCcbMcpAuthorityActive()
      .then((active) => setAuthorityState(active ? 'active' : 'inactive'))
      .catch((error) => {
        console.error('[CcbMcpHealthPanel] authority check failed:', error);
        setAuthorityState('error');
      });
  }, []);

  const diagnosis = report?.diagnosis;
  const overallOk = report?.ok;
  const failedCount = diagnosis?.failed_count ?? 0;
  const repairPlan = diagnosis?.repair_plan ?? [];

  const runCheck = useCallback(async (probe: boolean, options?: { keepRepairLog?: boolean }) => {
    setLoading(true);
    if (!options?.keepRepairLog) {
      setLastRepair(null);
    }
    try {
      const result = await ccbMcpService.runHealthCheck.invoke({ probe });
      setReport(result);
      return result;
    } catch (error) {
      console.error('[CcbMcpHealthPanel] health check failed:', error);
      Message.error(t('settings.ccbMcpHealthCheckError'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [t]);

  const runRepair = useCallback(
    async (actionIds?: CcbMcpHealthRepairActionId[]) => {
      setRepairing(true);
      try {
        const result = await ccbMcpService.repairHealth.invoke(actionIds?.length ? { actionIds } : {});
        setLastRepair(result);
        if (result.ok) {
          Message.success(t('settings.ccbMcpHealthRepairSuccess'));
        } else {
          Message.warning(t('settings.ccbMcpHealthRepairPartial'));
        }
        await runCheck(true, { keepRepairLog: true });
        return result;
      } catch (error) {
        console.error('[CcbMcpHealthPanel] repair failed:', error);
        Message.error(t('settings.ccbMcpHealthRepairError'));
        return null;
      } finally {
        setRepairing(false);
      }
    },
    [runCheck, t]
  );

  const openMinimaxDiagnosis = useCallback(async () => {
    if (!diagnosis) return;
    setAnalyzing(true);
    try {
      let autoRepair: CcbMcpHealthRepairResult | undefined;
      if (repairPlan.length > 0) {
        setRepairing(true);
        autoRepair =
          (await ccbMcpService.repairHealth.invoke({ actionIds: repairPlan })) ?? undefined;
        if (autoRepair) {
          setLastRepair(autoRepair);
        }
        setRepairing(false);
      }

      const freshReport = await ccbMcpService.runHealthCheck.invoke({ probe: true });
      setReport(freshReport);

      if (freshReport.ok) {
        Message.success(t('settings.ccbMcpHealthRepairSuccess'));
        return;
      }

      const prompt = buildMinimaxPromptForReport(freshReport, { autoRepair });
      if (!prompt) {
        Message.warning(t('settings.ccbMcpHealthMinimaxNoPrompt'));
        return;
      }

      void navigate('/guid', {
        state: {
          resetAssistant: true,
          selectedAgentKey: 'claude',
          prefilledInput: prompt,
        },
      });
    } catch (error) {
      console.error('[CcbMcpHealthPanel] minimax diagnosis flow failed:', error);
      Message.error(t('settings.ccbMcpHealthMinimaxError'));
    } finally {
      setAnalyzing(false);
      setRepairing(false);
      setLoading(false);
    }
  }, [diagnosis, navigate, repairPlan, t]);

  useEffect(() => {
    if (authorityState !== 'active') return;
    void runCheck(false);
  }, [authorityState, runCheck]);

  const authorityInactive = authorityState === 'inactive' || authorityState === 'error';

  const renderLayer = (key: LayerKey, items: CcbMcpHealthReport['config']['items'] | undefined, layerOk?: boolean) => {
    if (!items?.length) return null;
    return (
      <Collapse.Item
        key={key}
        name={key}
        header={
          <div className='flex items-center gap-8px text-13px'>
            <StatusDot ok={layerOk} />
            <span>{t(layerLabelKey[key])}</span>
            <Tag size='small' color={layerOk ? 'green' : 'red'}>
              {items.filter((i) => i.ok).length}/{items.length}
            </Tag>
          </div>
        }
      >
        <div className='pl-4px'>{items.map((item) => <HealthItemRow key={`${item.layer}-${item.id}`} item={item} />)}</div>
      </Collapse.Item>
    );
  };

  const repairPlanLabel = useMemo(
    () => repairPlan.map((id) => t(repairActionLabelKey[id])).join(' → '),
    [repairPlan, t]
  );

  return (
    <div className='mb-16px border border-border-2 rd-12px p-12px bg-[var(--color-bg-2)]'>
      <div className='flex items-center justify-between gap-8px mb-8px'>
        <div className='flex items-center gap-8px min-w-0'>
          <Heartbeat theme='outline' size={18} className='text-t-secondary shrink-0' />
          <div className='min-w-0'>
            <div className='text-14px text-t-primary font-medium'>{t('settings.ccbMcpHealthTitle')}</div>
            <div className='text-12px text-t-secondary truncate'>{t('settings.ccbMcpHealthSubtitle')}</div>
          </div>
          {report ? (
            <Tag color={overallOk ? 'green' : 'red'} size='small' className='shrink-0'>
              {overallOk ? t('settings.ccbMcpHealthPass') : t('settings.ccbMcpHealthFail', { count: failedCount })}
            </Tag>
          ) : null}
        </div>
        {authorityState === 'active' ? (
          <div className='flex items-center gap-6px shrink-0 flex-wrap justify-end'>
            <Tooltip content={t('settings.ccbMcpHealthQuickHint')}>
              <Button size='mini' loading={loading && !report?.probe} onClick={() => void runCheck(false)}>
                {t('settings.ccbMcpHealthQuick')}
              </Button>
            </Tooltip>
            <Tooltip content={t('settings.ccbMcpHealthFullHint')}>
              <Button
                size='mini'
                type='primary'
                loading={loading}
                icon={<Tool size={14} />}
                onClick={() => void runCheck(true)}
              >
                {t('settings.ccbMcpHealthFull')}
              </Button>
            </Tooltip>
          </div>
        ) : null}
      </div>

      {authorityState === 'loading' ? (
        <div className='flex items-center gap-8px text-12px text-t-secondary py-8px'>
          <LoadingOne fill={iconColors.primary} />
          {t('settings.ccbMcpHealthAuthorityLoading')}
        </div>
      ) : null}

      {authorityInactive ? (
        <div className='text-12px text-t-secondary py-8px leading-18px'>
          {authorityState === 'error'
            ? t('settings.ccbMcpHealthAuthorityError')
            : t('settings.ccbMcpHealthAuthorityInactive')}
        </div>
      ) : null}

      {report?.checked_at ? (
        <div className='text-11px text-t-secondary mb-8px'>
          {t('mcp.lastCheck')}: {new Date(report.checked_at).toLocaleString()}
        </div>
      ) : null}

      {diagnosis && !diagnosis.ok ? (
        <div className='mb-12px p-10px rd-8px border border-border-2 bg-[var(--color-bg-1)]'>
          <div className='text-13px text-t-primary font-medium mb-4px'>{t('settings.ccbMcpHealthDiagnosisTitle')}</div>
          <div className='text-12px text-t-secondary mb-8px'>{diagnosis.summary}</div>
          <div className='mb-8px'>
            {diagnosis.items.map((item) => (
              <DiagnosisItemRow key={item.key} item={item} t={t} />
            ))}
          </div>
          {repairPlan.length > 0 ? (
            <div className='text-11px text-t-secondary mb-8px'>
              {t('settings.ccbMcpHealthRepairPlan')}: {repairPlanLabel}
            </div>
          ) : null}
          <div className='flex items-center gap-6px flex-wrap'>
            {repairPlan.length > 0 ? (
              <Button
                size='mini'
                type='primary'
                status='warning'
                loading={repairing}
                onClick={() => void runRepair(repairPlan)}
              >
                {t('settings.ccbMcpHealthOneClickRepair', { count: repairPlan.length })}
              </Button>
            ) : null}
            <Tooltip content={t('settings.ccbMcpHealthMinimaxHint')}>
              <Button
                size='mini'
                type='outline'
                icon={<Robot size={14} />}
                loading={analyzing}
                disabled={!diagnosis}
                onClick={() => void openMinimaxDiagnosis()}
              >
                {t('settings.ccbMcpHealthMinimaxAnalyze')}
              </Button>
            </Tooltip>
            <Button size='mini' type='text' loading={repairing} onClick={() => void runRepair()}>
              {t('settings.ccbMcpHealthRepairAll')}
            </Button>
          </div>
        </div>
      ) : null}

      {lastRepair && lastRepair.steps.length > 0 ? (
        <div className='mb-8px text-11px text-t-secondary'>
          <div className='font-medium text-t-primary mb-4px'>{t('settings.ccbMcpHealthRepairLog')}</div>
          {lastRepair.steps.map((step) => (
            <div key={step.id} className='flex items-center gap-6px py-2px'>
              <StatusDot ok={step.ok} />
              <span className='font-mono'>{step.id}</span>
              <span>{step.detail}</span>
            </div>
          ))}
        </div>
      ) : null}

      {authorityState === 'active' && report ? (
        <Collapse bordered={false} defaultActiveKey={['config', 'probe']} className='ccb-mcp-health-collapse'>
          {renderLayer('config', report.config.items, report.config.ok)}
          {report.probe ? renderLayer('probe', report.probe.items, report.probe.ok) : null}
        </Collapse>
      ) : authorityState === 'active' && loading ? (
        <div className='flex items-center gap-8px text-12px text-t-secondary py-8px'>
          <LoadingOne fill={iconColors.primary} />
          {t('settings.ccbMcpHealthRunning')}
        </div>
      ) : null}
    </div>
  );
};

export default CcbMcpHealthPanel;
