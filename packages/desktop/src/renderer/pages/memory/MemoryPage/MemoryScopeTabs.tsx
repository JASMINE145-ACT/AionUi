/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { MemoryScope } from '@/common/config/ccbMemoryFiles';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';

type MemoryScopeTabsProps = {
  scope: MemoryScope;
  onChange: (scope: MemoryScope) => void;
};

const SCOPES: MemoryScope[] = ['personal', 'business'];

export const MemoryScopeTabs: React.FC<MemoryScopeTabsProps> = ({ scope, onChange }) => {
  const { t } = useTranslation();

  return (
    <div
      className='inline-flex p-3px rd-10px bg-fill-2 border border-[var(--color-border-2)]'
      role='tablist'
      aria-label={t('memory.scopeTabs', { defaultValue: 'Memory scope' })}
    >
      {SCOPES.map((item) => {
        const active = scope === item;
        return (
          <button
            key={item}
            type='button'
            role='tab'
            aria-selected={active}
            className={classNames(
              'px-14px py-7px rd-8px text-13px font-500 leading-20px transition-all duration-200 cursor-pointer border-none outline-none',
              active
                ? 'bg-[var(--color-bg-1)] text-t-primary shadow-sm'
                : 'bg-transparent text-t-secondary hover:text-t-primary'
            )}
            onClick={() => onChange(item)}
            data-testid={`memory-tab-${item}`}
          >
            {t(`memory.tab.${item}`)}
          </button>
        );
      })}
    </div>
  );
};
