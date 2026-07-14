/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  isCcbStartupSoftReadyWarning,
  type CcbStartupReadinessStatus,
} from '@/common/config/ccbStartupReadinessShared';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type CcbStartupReadinessBannerProps = {
  status: CcbStartupReadinessStatus;
  isPreparing: boolean;
  onRetry?: () => void | Promise<void>;
};

const CcbStartupReadinessBanner: React.FC<CcbStartupReadinessBannerProps> = ({
  status,
  isPreparing,
  onRetry,
}) => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (isPreparing || status.mcp_ok) {
      setDismissed(false);
    }
  }, [isPreparing, status.mcp_ok]);

  if (status.phase === 'error' && !status.soft_ready) {
    return (
      <div className='mb-12px px-12px py-8px rounded-8px text-13px bg-[var(--color-danger-light-1)] text-[var(--color-danger-6)]'>
        {t('guid.ccbStartupReadiness.error', {
          defaultValue: 'CCB 启动检查未通过：{{detail}}',
          detail: status.error ?? t('common.unknownError'),
        })}
      </div>
    );
  }

  if (isPreparing) {
    const phaseLabel =
      status.phase === 'config'
        ? t('guid.ccbStartupReadiness.config', { defaultValue: '正在检查配置…' })
        : t('guid.ccbStartupReadiness.mcpWarm', { defaultValue: '正在预热报价 MCP（首次约 1–2 分钟）…' });
    return (
      <div className='mb-12px px-12px py-8px rounded-8px text-13px bg-[var(--color-primary-light-1)] text-[var(--color-text-2)]'>
        {phaseLabel}
      </div>
    );
  }

  if (dismissed || !isCcbStartupSoftReadyWarning(status)) {
    return null;
  }

  const detail = status.error?.trim();

  return (
    <div className='mb-12px px-12px py-8px rounded-8px text-13px bg-[var(--color-warning-light-1)] text-[var(--color-text-2)] flex flex-col gap-6px'>
      <div>
        {t('guid.ccbStartupReadiness.softReady', {
          defaultValue: 'MCP 预热未完成，首条查询可能较慢。',
        })}
        {detail ? (
          <div className='mt-4px text-12px opacity-80 break-all'>
            {t('guid.ccbStartupReadiness.softReadyDetail', {
              defaultValue: '详情：{{detail}}',
              detail,
            })}
          </div>
        ) : null}
      </div>
      <div className='flex gap-8px'>
        {onRetry ? (
          <button
            type='button'
            className='px-8px py-2px rounded-4px text-12px bg-[var(--color-bg-1)] border border-[var(--color-border-2)] disabled:opacity-50'
            disabled={retrying}
            onClick={() => {
              setRetrying(true);
              void Promise.resolve(onRetry())
                .catch(() => undefined)
                .finally(() => setRetrying(false));
            }}
          >
            {retrying
              ? t('guid.ccbStartupReadiness.retrying', { defaultValue: '重试中…' })
              : t('guid.ccbStartupReadiness.retry', { defaultValue: '重试预热' })}
          </button>
        ) : null}
        <button
          type='button'
          className='px-8px py-2px rounded-4px text-12px bg-[var(--color-bg-1)] border border-[var(--color-border-2)]'
          onClick={() => setDismissed(true)}
        >
          {t('guid.ccbStartupReadiness.dismiss', { defaultValue: '关闭' })}
        </button>
      </div>
    </div>
  );
};

export default CcbStartupReadinessBanner;
