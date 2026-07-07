/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@arco-design/web-react';
import { Notes } from '@icon-park/react';
import classNames from 'classnames';
import type { SiderTooltipProps } from '@renderer/utils/ui/siderTooltip';

interface SiderMemoryEntryProps {
  isMobile: boolean;
  isActive: boolean;
  collapsed: boolean;
  siderTooltipProps: SiderTooltipProps;
  visible: boolean;
  onClick: () => void;
}

const SiderMemoryEntry: React.FC<SiderMemoryEntryProps> = ({
  isMobile,
  isActive,
  collapsed,
  siderTooltipProps,
  visible,
  onClick,
}) => {
  const { t } = useTranslation();

  if (!visible) {
    return null;
  }

  const icon = (
    <Notes theme='outline' size={collapsed ? '20' : '16'} fill='currentColor' className='block leading-none shrink-0' />
  );

  if (collapsed) {
    return (
      <Tooltip {...siderTooltipProps} content={t('memory.title', { defaultValue: '记忆' })} position='right'>
        <div
          className={classNames(
            'w-full h-34px flex items-center justify-center cursor-pointer transition-colors rd-8px text-t-primary',
            isActive ? 'bg-fill-3' : 'hover:bg-fill-3 active:bg-fill-4'
          )}
          onClick={onClick}
          data-testid='sider-memory-entry'
        >
          {icon}
        </div>
      </Tooltip>
    );
  }

  return (
    <Tooltip {...siderTooltipProps} content={t('memory.title', { defaultValue: '记忆' })} position='right'>
      <div
        className={classNames(
          'box-border group h-34px w-full flex items-center justify-start gap-8px pl-10px pr-8px rd-0.5rem cursor-pointer shrink-0 transition-all text-t-primary',
          isMobile && 'sider-action-btn-mobile',
          isActive ? 'bg-fill-3' : 'hover:bg-fill-3 active:bg-fill-4'
        )}
        onClick={onClick}
        data-testid='sider-memory-entry'
      >
        <span className='size-22px flex items-center justify-center shrink-0 text-t-primary'>{icon}</span>
        <span className='collapsed-hidden text-t-primary text-14px font-[500] leading-24px flex-1 min-w-0'>
          {t('memory.title', { defaultValue: '记忆' })}
        </span>
      </div>
    </Tooltip>
  );
};

export default SiderMemoryEntry;
