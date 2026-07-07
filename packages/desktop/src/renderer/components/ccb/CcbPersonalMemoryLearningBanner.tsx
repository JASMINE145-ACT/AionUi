/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  visible: boolean;
};

const CcbPersonalMemoryLearningBanner: React.FC<Props> = ({ visible }) => {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <div
      className='mb-12px px-12px py-8px rounded-8px text-13px bg-[var(--color-primary-light-1)] text-[var(--color-text-2)]'
      data-testid='ccb-personal-memory-learning-banner'
    >
      {t('guid.personalMemory.learning', {
        defaultValue: 'Agent 正在学习记录您的习惯',
      })}
    </div>
  );
};

export default CcbPersonalMemoryLearningBanner;
