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
import type {
  CcbMcpHealthLayerResult,
  CcbMcpHealthReport,
  CcbMcpHealthRepairResult,
} from '@/common/config/ccbMcpHealthShared';
import type { CcbMcpHealthDiagnosis, CcbMcpHealthRepairActionId } from '@/common/config/ccbMcpHealthDiagnosis';
import { buildMinimaxPromptForReport } from '@/common/config/ccbMcpHealthDiagnosis';
import { CCB_MCP_HEALTH_COVERAGE_ROWS } from '@/common/config/ccbMcpHealthCoverage';
import { isCcbMcpAuthorityActive, resetCcbMcpAuthorityCache } from '@/renderer/hooks/mcp/ccbMcpAuthority';
import { iconColors } from '@/renderer/styles/colors';

type LayerKey = 'config' | 'files' | 'agents' | 'probe' | 'session' | 'optional';

const layerLabelKey: Record<LayerKey, string> = {
  config: 'settings.ccbMcpHealthLayerConfigOnly',
  files: 'settings.ccbMcpHealthLayerFiles',
  agents: 'settings.ccbMcpHealthLayerAgents',
  probe: 'settings.ccbMcpHealthLayerProbe',
  session: 'settings.ccbMcpHealthLayerSession',
  optional: 'settings.ccbMcpHealthLayerOptional',
};

const nextStepLabelKey: Record<NonNullable<CcbMcpHealthDiagnosis['items'][number]['next_step']>, string> = {
  repair: 'settings.ccbMcpHealthNextStepRepair',
  new_guid: 'settings.ccbMcpHealthNextStepNewGuid',
  cli_session: 'settings.ccbMcpHealthNextStepCliSession',
  manual: 'settings.ccbMcpHealthNextStepManual',
};

const repairActionLabelKey: Record<CcbMcpHealthRepairActionId, string> = {
  'ensure-wanding-settings': 'settings.ccbMcpHealthActionEnsureSettings',
  'deploy-seed-agents': 'settings.ccbMcpHealthActionDeploySeeds',
  'repair-word-creator': 'settings.ccbMcpHealthActionRepairWord',
  'repair-excel-creator': 'settings.ccbMcpHealthActionRepairExcel',
  'repair-subagent-mcp': 'settings.ccbMcpHealthActionRepairSubagent',
};

const StatusDot: React.FC<{ ok?: boolean; warn?: boolean; loading?: boolean }> = ({ ok, warn, loading }) => {
  if (loading) {
    return <LoadingOne fill={iconColors.primary} className='h-16px w-16px' />;
  }
  if (ok === true) {
    return <Check fill={iconColors.success} className='h-16px w-16px' />;
  }
  if (ok === false && warn) {
    return <span className='inline-block w-8px h-8px rounded-full bg-[rgb(var(--warning-6))] shrink-0 mt-4px' />;
  }
  if (ok === false) {
    return <CloseSmall fill={iconColors.danger} className='h-16px w-16px' />;
  }
  return <span className='inline-block w-8px h-8px rounded-full bg-[var(--color-fill-3)]' />;
};

const HealthItemRow: React.FC<{ item: { id: string; detail: string; ok?: boolean; warn?: boolean } }> = ({
  item,
}) => (
  <div className='flex items-start gap-8px py-4px text-12px leading-18px'>
    <StatusDot ok={item.ok} warn={item.warn} />
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
        {item.next_step ? (
          <div className='text-11px text-t-secondary mt-2px'>
            {t('settings.ccbMcpHealthNextStep')}: {t(nextStepLabelKey[item.next_step])}
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
  const [sessionLoading, setSessionLoading] = useState(false);
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

  const runCheck = useCallback(
    async (options: { probe?: boolean; session?: boolean; keepRepairLog?: boolean }) => {
      setLoading(true);
      if (options.session) {
        setSessionLoading(true);
      }
      if (!options.keepRepairLog) {
        setLastRepair(null);
      }
      try {
        const result = await ccbMcpService.runHealthCheck.invoke({
          probe: Boolean(options.probe),
          session: Boolean(options.session),
        });
        setReport(result);
        return result;
      } catch (error) {
        console.error('[CcbMcpHealthPanel] health check failed:', error);
        Message.error(t('settings.ccbMcpHealthCheckError'));
        return null;
      } finally {
        setLoading(false);
        setSessionLoading(false);
      }
    },
    [t]
  );

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
        await runCheck({ probe: true, keepRepairLog: true });
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

      const freshReport = await ccbMcpService.runHealthCheck.invoke({ probe: true, session: false });
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
    void runCheck({ probe: false });
  }, [authorityState, runCheck]);

  const authorityInactive = authorityState === 'inactive' || authorityState === 'error';

  const renderLayer = (key: LayerKey, layer: CcbMcpHealthLayerResult | undefined) => {
    if (!layer?.items?.length) return null;
    const warnCount = layer.items.filter((i) => !i.ok && i.warn).length;
    const passCount = layer.items.filter((i) => i.ok).length;
    const tagColor = layer.ok ? (warnCount > 0 ? 'orange' : 'green') : 'red';
    return (
      <Collapse.Item
        key={key}
        name={key}
        header={
          <div className='flex items-center gap-8px text-13px'>
            <StatusDot ok={layer.ok} warn={layer.ok && warnCount > 0} />
            <span>{t(layerLabelKey[key])}</span>
            <Tag size='small' color={tagColor}>
              {passCount}/{layer.items.length}
              {warnCount > 0 ? ` (${warnCount} warn)` : ''}
            </Tag>
          </div>
        }
      >
        <div className='pl-4px'>
          {layer.items.map((item) => (
            <HealthItemRow key={`${item.layer}-${item.id}`} item={item} />
          ))}
        </div>
      </Collapse.Item>
    );
  };

  const coverageYesNo = (value: boolean) => (value ? '✓' : '—');

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
              <Button
                size='mini'
                loading={loading && !report?.probe && !report?.session}
                onClick={() => void runCheck({ probe: false })}
              >
                {t('settings.ccbMcpHealthQuick')}
              </Button>
            </Tooltip>
            <Tooltip content={t('settings.ccbMcpHealthFullHint')}>
              <Button
                size='mini'
                type='primary'
                loading={loading && !sessionLoading}
                icon={<Tool size={14} />}
                onClick={() => void runCheck({ probe: true })}
              >
                {t('settings.ccbMcpHealthFull')}
              </Button>
            </Tooltip>
            <Tooltip content={t('settings.ccbMcpHealthSessionHint')}>
              <Button
                size='mini'
                type='outline'
                loading={sessionLoading}
                onClick={() => void runCheck({ probe: true, session: true })}
              >
                {t('settings.ccbMcpHealthSession')}
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
        <Collapse bordered={false} defaultActiveKey={['config', 'agents', 'probe']} className='ccb-mcp-health-collapse'>
          {renderLayer('config', report.config)}
          {renderLayer('files', report.files)}
          {renderLayer('agents', report.agents)}
          {renderLayer('probe', report.probe)}
          {renderLayer('session', report.session)}
          {renderLayer('optional', report.optional)}
          <Collapse.Item name='coverage' header={t('settings.ccbMcpHealthCoverageTitle')}>
            <div className='text-11px text-t-secondary mb-6px'>{t('settings.ccbMcpHealthCoverageHint')}</div>
            <div className='overflow-x-auto'>
              <table className='w-full text-11px border-collapse'>
                <thead>
                  <tr className='text-t-secondary text-left'>
                    <th className='py-4px pr-8px'>{t('settings.ccbMcpHealthCoverageComponent')}</th>
                    <th className='py-4px px-4px'>{t('settings.ccbMcpHealthCoverageQuick')}</th>
                    <th className='py-4px px-4px'>{t('settings.ccbMcpHealthCoverageProbe')}</th>
                    <th className='py-4px px-4px'>{t('settings.ccbMcpHealthCoverageDeep')}</th>
                    <th className='py-4px px-4px'>{t('settings.ccbMcpHealthCoverageSession')}</th>
                  </tr>
                </thead>
                <tbody>
                  {CCB_MCP_HEALTH_COVERAGE_ROWS.map((row) => (
                    <tr key={row.id} className='border-t border-border-2'>
                      <td className='py-4px pr-8px font-mono text-t-primary'>
                        {row.label}
                        {row.notes ? (
                          <span className='block text-t-secondary font-sans normal-case'>{row.notes}</span>
                        ) : null}
                      </td>
                      <td className='py-4px px-4px text-center'>{coverageYesNo(row.uiQuick)}</td>
                      <td className='py-4px px-4px text-center'>{coverageYesNo(row.uiProbe)}</td>
                      <td className='py-4px px-4px text-center'>{coverageYesNo(row.uiDeep)}</td>
                      <td className='py-4px px-4px text-center'>{coverageYesNo(row.uiSession)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Collapse.Item>
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
