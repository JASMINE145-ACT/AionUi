/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { MemoryScope } from '@/common/config/ccbMemoryFiles';
import { Inbox, Notes } from '@icon-park/react';
import { useTranslation } from 'react-i18next';

type MemoryEmptyPanelProps = {
  scope: MemoryScope;
};

export const MemoryEmptyPanel: React.FC<MemoryEmptyPanelProps> = ({ scope }) => {
  const { t } = useTranslation();

  const title =
    scope === 'business'
      ? t('memory.empty.businessTitle', { defaultValue: 'No business memory yet' })
      : t('memory.empty.personalTitle', { defaultValue: 'No personal memory files' });

  const description =
    scope === 'business'
      ? t('memory.businessEmpty')
      : t('memory.personalEmpty');

  const hint =
    scope === 'business'
      ? t('memory.empty.businessHint', {
          defaultValue: 'Business rules are managed via Knowledge Base or append_business_rule.',
        })
      : t('memory.empty.personalHint', {
          defaultValue: 'Run CCB ensure / install seed, or let the agent learn from conversations.',
        });

  return (
    <div
      className='flex-1 min-h-0 flex flex-col items-center justify-center rd-12px border border-dashed border-[var(--color-border-2)] bg-[var(--color-bg-2)] px-24px py-32px text-center'
      data-testid={`memory-empty-${scope}`}
    >
      <div
        className='size-64px rd-16px flex items-center justify-center mb-16px'
        style={{
          background: 'linear-gradient(135deg, rgba(37,99,235,0.1) 0%, rgba(100,116,139,0.08) 100%)',
          color: 'rgb(var(--primary-6))',
        }}
      >
        {scope === 'business' ? (
          <Inbox theme='outline' size={32} fill='currentColor' />
        ) : (
          <Notes theme='outline' size={32} fill='currentColor' />
        )}
      </div>
      <h2 className='m-0 text-16px font-600 text-t-primary'>{title}</h2>
      <p className='m-0 mt-8px text-13px leading-22px text-t-secondary max-w-440px'>{description}</p>
      <p className='m-0 mt-12px text-12px leading-20px text-t-tertiary max-w-400px'>{hint}</p>
    </div>
  );
};
