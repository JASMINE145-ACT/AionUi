/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpAskUserQuestion } from '@/common/types/platform/acpTypes';
import { CheckOne } from '@icon-park/react';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';

type AskUserQuestionNavBarProps = {
  questions: AcpAskUserQuestion[];
  activeIndex: number;
  answers: Record<string, string>;
};

const AskUserQuestionNavBar: React.FC<AskUserQuestionNavBarProps> = ({
  questions,
  activeIndex,
  answers,
}) => {
  const { t } = useTranslation();
  if (questions.length <= 1) return null;

  return (
    <div
      className='flex flex-wrap items-center gap-6px px-16px py-10px border-b border-border-2 bg-fill-2/60'
      data-testid='ask-user-question-nav'
    >
      <span className='text-12px text-t-secondary mr-4px shrink-0'>
        {t('messages.askUserQuestion.progress', {
          current: activeIndex + 1,
          total: questions.length,
          defaultValue: '{{current}}/{{total}}',
        })}
      </span>
      {questions.map((q, index) => {
        const isActive = index === activeIndex;
        const isAnswered = Boolean(q.question && answers[q.question]);
        const tabLabel = q.header || `Q${index + 1}`;
        return (
          <span
            key={`${index}-${q.question}`}
            className={classNames(
              'inline-flex items-center gap-4px px-8px py-4px rd-6px text-12px transition-colors',
              isActive
                ? 'bg-[rgb(var(--primary-6))] text-white font-500'
                : isAnswered
                  ? 'bg-[rgb(var(--primary-1))] text-[rgb(var(--primary-6))]'
                  : 'bg-fill-3 text-t-secondary'
            )}
            data-testid={`ask-user-question-nav-${index}`}
            data-active={isActive ? 'true' : 'false'}
            data-answered={isAnswered ? 'true' : 'false'}
          >
            {isAnswered ? <CheckOne theme='filled' size={12} /> : null}
            {tabLabel}
          </span>
        );
      })}
    </div>
  );
};

export default AskUserQuestionNavBar;
