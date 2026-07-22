/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Button } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

type PrecipitationSessionChipProps = {
  conversationId: string;
  pendingCount: number;
  lastEvent?: string | null;
  skippedReason?: string | null;
  lastWorkerDetail?: string | null;
  status?: string | null;
  onDismiss: () => void;
};

function describeState(props: PrecipitationSessionChipProps, t: (k: string, o?: object) => string): string {
  if (props.pendingCount > 0) {
    return t('memory.inbox.sessionChip', {
      defaultValue: '本轮对话已沉淀 · {{count}} 条待确认',
      count: props.pendingCount,
    });
  }
  const event = props.lastEvent || '';
  if (event === 'armed') {
    return t('memory.inbox.chipArmed', { defaultValue: '沉淀已调度（空闲等待中）' });
  }
  if (event === 'cancelled') {
    return t('memory.inbox.chipCancelled', { defaultValue: '沉淀已取消（检测到新消息）' });
  }
  if (event === 'scheduled' || event === 'worker_running') {
    return t('memory.inbox.chipRunning', { defaultValue: '沉淀 worker 运行中…' });
  }
  if (event === 'schedule_skipped' || event === 'worker_skipped' || props.status === 'skipped') {
    const reason = props.skippedReason || props.lastWorkerDetail || 'unknown';
    return t('memory.inbox.chipSkipped', {
      defaultValue: '沉淀已跳过：{{reason}}',
      reason,
    });
  }
  if (event === 'approved' || event === 'denied') {
    return t('memory.inbox.chipResolved', { defaultValue: '沉淀审批已更新' });
  }
  return '';
}

export const PrecipitationSessionChip: React.FC<PrecipitationSessionChipProps> = (props) => {
  const { conversationId, pendingCount, onDismiss } = props;
  const { t } = useTranslation();
  const navigate = useNavigate();

  const label = describeState(props, t as (k: string, o?: object) => string);
  if (!label) return null;

  const showInboxNav = pendingCount > 0;

  return (
    <div
      className='mb-8px flex items-center justify-between gap-8px px-12px py-8px rd-8px border border-[var(--color-border-2)] bg-[var(--color-fill-2)] text-13px'
      data-testid='precipitation-session-chip'
    >
      <span className='text-t-primary'>{label}</span>
      <span className='flex items-center gap-8px shrink-0'>
        {showInboxNav ? (
          <Button
            size='mini'
            type='primary'
            onClick={() => navigate(`/memory?tab=inbox&conversation=${conversationId}`)}
          >
            {t('memory.inbox.view', { defaultValue: '查看' })}
          </Button>
        ) : null}
        <Button size='mini' type='text' onClick={onDismiss}>
          {t('memory.inbox.dismiss', { defaultValue: '忽略' })}
        </Button>
      </span>
    </div>
  );
};
