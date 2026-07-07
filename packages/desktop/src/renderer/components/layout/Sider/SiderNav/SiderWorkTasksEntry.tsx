/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@arco-design/web-react';
import { ListCheckbox } from '@icon-park/react';
import classNames from 'classnames';
import type { SiderTooltipProps } from '@renderer/utils/ui/siderTooltip';
import { usePendingAcceptCount } from '@renderer/pages/workTasks/useWorkTasks';

interface SiderWorkTasksEntryProps {
  isMobile: boolean;
  isActive: boolean;
  collapsed: boolean;
  siderTooltipProps: SiderTooltipProps;
  onClick: () => void;
}

const COUNT_BADGE_CLASS =
  'min-w-18px h-18px px-4px rounded-full text-10px font-semibold flex items-center justify-center leading-none bg-danger-6 text-white shrink-0';

function formatCountBadge(count: number): string {
  return count > 99 ? '99+' : String(count);
}

const SiderWorkTasksEntry: React.FC<SiderWorkTasksEntryProps> = ({
  isMobile,
  isActive,
  collapsed,
  siderTooltipProps,
  onClick,
}) => {
  const { t } = useTranslation();
  const pendingCount = usePendingAcceptCount();
  const showPending = pendingCount > 0;
  const countLabel = formatCountBadge(pendingCount);

  const tooltipContent = showPending
    ? t('workTasks.sider.pendingAcceptTooltip', { count: pendingCount })
    : t('workTasks.workTasks');

  const rowA11yLabel = showPending
    ? t('workTasks.sider.pendingAcceptA11y', { count: pendingCount })
    : t('workTasks.workTasks');

  const iconNode = (
    <ListCheckbox
      theme='outline'
      size={collapsed ? '20' : '16'}
      fill='currentColor'
      className='block leading-none shrink-0'
    />
  );

  const iconWithBadge = collapsed && showPending ? (
    <span className='relative inline-flex'>
      {iconNode}
      <span
        className='absolute -top-4px -right-6px min-w-16px h-16px px-3px rounded-full text-9px font-bold flex items-center justify-center leading-none bg-danger-6 text-white ring-2 ring-[var(--color-bg-2)] pointer-events-none'
        aria-hidden
      >
        {countLabel}
      </span>
    </span>
  ) : (
    iconNode
  );

  if (collapsed) {
    return (
      <Tooltip {...siderTooltipProps} content={tooltipContent} position='right'>
        <div
          className={classNames(
            'w-full h-34px flex items-center justify-center cursor-pointer transition-colors rd-8px text-t-primary',
            isActive ? 'bg-fill-3' : 'hover:bg-fill-3 active:bg-fill-4'
          )}
          onClick={onClick}
          aria-label={rowA11yLabel}
        >
          {iconWithBadge}
        </div>
      </Tooltip>
    );
  }

  return (
    <Tooltip {...siderTooltipProps} content={tooltipContent} position='right'>
      <div
        className={classNames(
          'box-border group h-34px w-full flex items-center justify-start gap-8px pl-10px pr-8px rd-0.5rem cursor-pointer shrink-0 transition-all text-t-primary',
          isMobile && 'sider-action-btn-mobile',
          isActive ? 'bg-fill-3' : 'hover:bg-fill-3 active:bg-fill-4'
        )}
        onClick={onClick}
        aria-label={rowA11yLabel}
      >
        <span className='size-22px flex items-center justify-center shrink-0 text-t-primary'>{iconNode}</span>
        <span className='collapsed-hidden text-t-primary text-14px font-[500] leading-24px flex-1 min-w-0'>
          {t('workTasks.workTasks')}
        </span>
        {showPending && (
          <span className={COUNT_BADGE_CLASS} role='status' aria-hidden>
            {countLabel}
          </span>
        )}
      </div>
    </Tooltip>
  );
};

export default SiderWorkTasksEntry;
