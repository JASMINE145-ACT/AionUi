/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CcbStartupReadinessStatus } from '@/common/config/ccbStartupReadinessShared';
import React from 'react';
import { useTranslation } from 'react-i18next';

type CcbStartupReadinessBannerProps = {
  status: CcbStartupReadinessStatus;
  isPreparing: boolean;
};

const CcbStartupReadinessBanner: React.FC<CcbStartupReadinessBannerProps> = ({ status, isPreparing }) => {
  const { t } = useTranslation();

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

  if (status.soft_ready && !status.mcp_ok) {
    return (
      <div className='mb-12px px-12px py-8px rounded-8px text-13px bg-[var(--color-warning-light-1)] text-[var(--color-text-2)]'>
        {t('guid.ccbStartupReadiness.softReady', {
          defaultValue: 'MCP 预热未完成，首条查询可能较慢。',
        })}
      </div>
    );
  }

  return null;
};

export default CcbStartupReadinessBanner;
