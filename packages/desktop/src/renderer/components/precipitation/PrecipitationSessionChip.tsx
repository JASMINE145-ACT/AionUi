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
  onDismiss: () => void;
};

export const PrecipitationSessionChip: React.FC<PrecipitationSessionChipProps> = ({
  conversationId,
  pendingCount,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (pendingCount <= 0) return null;

  return (
    <div
      className='mb-8px flex items-center justify-between gap-8px px-12px py-8px rd-8px border border-[var(--color-border-2)] bg-[var(--color-fill-2)] text-13px'
      data-testid='precipitation-session-chip'
    >
      <span className='text-t-primary'>
        {t('memory.inbox.sessionChip', {
          defaultValue: '本轮对话已沉淀 · {{count}} 条待确认',
          count: pendingCount,
        })}
      </span>
      <span className='flex items-center gap-8px shrink-0'>
        <Button
          size='mini'
          type='primary'
          onClick={() => navigate(`/memory?tab=inbox&conversation=${conversationId}`)}
        >
          {t('memory.inbox.view', { defaultValue: '查看' })}
        </Button>
        <Button size='mini' type='text' onClick={onDismiss}>
          {t('memory.inbox.dismiss', { defaultValue: '忽略' })}
        </Button>
      </span>
    </div>
  );
};
