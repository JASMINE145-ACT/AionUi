/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Badge } from '@arco-design/web-react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import type { MemoryPageTab } from './memoryPageTab';

type MemoryScopeTabsProps = {
  tab: MemoryPageTab;
  pendingCount?: number;
  onChange: (tab: MemoryPageTab) => void;
};

const TABS: MemoryPageTab[] = ['personal', 'business', 'inbox'];

export const MemoryScopeTabs: React.FC<MemoryScopeTabsProps> = ({ tab, pendingCount = 0, onChange }) => {
  const { t } = useTranslation();

  return (
    <div
      className='inline-flex p-3px rd-10px bg-fill-2 border border-[var(--color-border-2)]'
      role='tablist'
      aria-label={t('memory.scopeTabs', { defaultValue: 'Memory scope' })}
    >
      {TABS.map((item) => {
        const active = tab === item;
        const label =
          item === 'inbox'
            ? t('memory.tab.inbox', { defaultValue: '待沉淀' })
            : t(`memory.tab.${item}`);
        return (
          <button
            key={item}
            type='button'
            role='tab'
            aria-selected={active}
            className={classNames(
              'px-14px py-7px rd-8px text-13px font-500 leading-20px transition-all duration-200 cursor-pointer border-none outline-none inline-flex items-center gap-6px',
              active
                ? 'bg-[var(--color-bg-1)] text-t-primary shadow-sm'
                : 'bg-transparent text-t-secondary hover:text-t-primary'
            )}
            onClick={() => onChange(item)}
            data-testid={`memory-tab-${item}`}
          >
            {label}
            {item === 'inbox' && pendingCount > 0 ? (
              <Badge count={pendingCount} maxCount={99} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
};
