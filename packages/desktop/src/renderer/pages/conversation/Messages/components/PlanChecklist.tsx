/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessagePlan } from '@/common/chat/chatLib';
import { CheckOne, List, Right } from '@icon-park/react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type PlanChecklistProps = {
  message: IMessagePlan;
  /** When set, shown above the checklist (SubagentDrawer section title). */
  sectionTitle?: string;
  className?: string;
};

const PlanChecklist: React.FC<PlanChecklistProps> = ({ message, sectionTitle, className }) => {
  const { t } = useTranslation();
  const entries = message.content.entries ?? [];
  const doneCount = useMemo(
    () => entries.filter((entry) => entry.status === 'completed').length,
    [entries],
  );

  if (!entries.length) {
    return null;
  }

  return (
    <div
      className={
        'rd-12px border border-[var(--color-border-2)] p-12px flex flex-col gap-8px' +
        (className ? ` ${className}` : '')
      }
      data-testid='plan-checklist'
    >
      {sectionTitle ? (
        <div className='text-sm font-medium text-t-primary mb-4px'>{sectionTitle}</div>
      ) : null}
      <div className='flex items-center gap-8px text-t-secondary text-13px'>
        <List theme='outline' size='16' />
        <span data-testid='plan-checklist-header'>
          {t('conversation.plan.checklist.header', { done: doneCount, total: entries.length })}
        </span>
      </div>
      <div className='flex flex-col gap-8px'>
        {entries.map((entry, index) => {
          const isCompleted = entry.status === 'completed';
          const isInProgress = entry.status === 'in_progress';
          return (
            <div key={`${entry.content}-${index}`} className='flex flex-row items-center gap-8px min-w-0'>
              {isCompleted ? (
                <CheckOne theme='filled' size='16' fill='var(--color-success-6)' />
              ) : isInProgress ? (
                <span className='size-16px flex items-center justify-center shrink-0'>
                  <Right theme='filled' size='14' fill='var(--color-primary-6)' />
                </span>
              ) : (
                <span className='size-16px flex items-center justify-center shrink-0'>
                  <span className='size-14px rd-10px border border-dashed border-[var(--color-border-3)]' />
                </span>
              )}
              <span
                className={
                  'text-13px min-w-0 break-words' +
                  (isCompleted ? ' line-through text-t-tertiary' : '') +
                  (isInProgress ? ' text-t-primary font-500' : ' text-t-secondary')
                }
              >
                {entry.content}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlanChecklist;
