/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataServer, Right } from '@icon-park/react';
import { Tooltip } from '@arco-design/web-react';
import classNames from 'classnames';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SiderTooltipProps } from '@renderer/utils/ui/siderTooltip';
import { isOrgServerConfigured } from '@/common/adapter/orgHttpBridge';
import {
  isOrgDatabasePath,
  ORG_DATABASE_SECTION_EXPANDED_KEY,
} from './orgDatabaseNavRegistry';
import {
  SiderOrgKnowledgeEntry,
  SiderPriceLibraryEntry,
  SiderSuppliersEntry,
} from './SiderNav';

interface OrgDatabaseSiderSectionProps {
  isMobile: boolean;
  pathname: string;
  collapsed: boolean;
  siderTooltipProps: SiderTooltipProps;
  onOrgKnowledgeClick: () => void;
  onPriceLibraryClick: () => void;
  onSuppliersClick: () => void;
}

/**
 * Fold group for org data libraries. Header row matches WorkTasks entry
 * (icon + label + caret); children reuse existing Sider*Entry rows.
 */
const OrgDatabaseSiderSection: React.FC<OrgDatabaseSiderSectionProps> = ({
  isMobile,
  pathname,
  collapsed,
  siderTooltipProps,
  onOrgKnowledgeClick,
  onPriceLibraryClick,
  onSuppliersClick,
}) => {
  const { t } = useTranslation();
  const childActive = isOrgDatabasePath(pathname);
  const prevPathnameRef = useRef(pathname);

  const [expanded, setExpanded] = useState<boolean>(() => {
    if (isOrgDatabasePath(pathname)) return true;
    const raw = localStorage.getItem(ORG_DATABASE_SECTION_EXPANDED_KEY);
    return raw === null ? true : raw === 'true';
  });

  useEffect(() => {
    localStorage.setItem(ORG_DATABASE_SECTION_EXPANDED_KEY, String(expanded));
  }, [expanded]);

  // Auto-expand when navigating into a library route (not while user collapses on that page).
  useLayoutEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = pathname;
      if (isOrgDatabasePath(pathname)) {
        setExpanded(true);
      }
    }
  }, [pathname]);

  if (!isOrgServerConfigured()) {
    return null;
  }

  const title = t('orgDatabase.title');
  const icon = (
    <DataServer
      theme='outline'
      size={collapsed ? '20' : '16'}
      fill='currentColor'
      className='block leading-none shrink-0'
    />
  );

  const toggle = () => setExpanded((v) => !v);

  const onToggleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  };

  const toggleA11y = {
    role: 'button' as const,
    tabIndex: 0,
    'aria-expanded': expanded,
    'aria-controls': 'org-database-nav',
    'data-testid': 'org-database-section-toggle',
    onClick: toggle,
    onKeyDown: onToggleKeyDown,
  };

  if (collapsed) {
    return (
      <div className='shrink-0 flex flex-col gap-2px'>
        <Tooltip {...siderTooltipProps} content={title} position='right'>
          <div
            className={classNames(
              'w-full h-34px flex items-center justify-center cursor-pointer transition-colors rd-8px text-t-primary',
              childActive && !expanded ? 'bg-fill-3' : 'hover:bg-fill-3 active:bg-fill-4'
            )}
            {...toggleA11y}
          >
            {icon}
          </div>
        </Tooltip>
        {expanded ? (
          <div id='org-database-nav' className='flex flex-col gap-2px'>
            <SiderOrgKnowledgeEntry
              isMobile={isMobile}
              isActive={pathname === '/org-knowledge'}
              collapsed={collapsed}
              siderTooltipProps={siderTooltipProps}
              onClick={onOrgKnowledgeClick}
            />
            <SiderPriceLibraryEntry
              isMobile={isMobile}
              isActive={pathname === '/price-library'}
              collapsed={collapsed}
              siderTooltipProps={siderTooltipProps}
              onClick={onPriceLibraryClick}
            />
            <SiderSuppliersEntry
              isMobile={isMobile}
              isActive={pathname === '/suppliers'}
              collapsed={collapsed}
              siderTooltipProps={siderTooltipProps}
              onClick={onSuppliersClick}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className='shrink-0 flex flex-col gap-2px'>
      <Tooltip {...siderTooltipProps} content={title} position='right'>
        <div
          className={classNames(
            'box-border group h-34px w-full flex items-center justify-start gap-8px pl-10px pr-8px rd-0.5rem cursor-pointer shrink-0 transition-all text-t-primary',
            isMobile && 'sider-action-btn-mobile',
            childActive && !expanded ? 'bg-fill-3' : 'hover:bg-fill-3 active:bg-fill-4'
          )}
          {...toggleA11y}
        >
          <span className='size-22px flex items-center justify-center shrink-0 text-t-primary'>{icon}</span>
          <span className='collapsed-hidden text-t-primary text-14px font-[500] leading-24px flex-1 min-w-0'>
            {title}
          </span>
          <span className='collapsed-hidden flex items-center justify-center text-t-tertiary shrink-0'>
            <Right
              theme='outline'
              size={12}
              className={classNames('transition-transform duration-150', { 'rotate-90': expanded })}
            />
          </span>
        </div>
      </Tooltip>
      {expanded ? (
        <div id='org-database-nav' className='flex flex-col gap-2px pl-12px'>
          <SiderOrgKnowledgeEntry
            isMobile={isMobile}
            isActive={pathname === '/org-knowledge'}
            collapsed={collapsed}
            siderTooltipProps={siderTooltipProps}
            onClick={onOrgKnowledgeClick}
          />
          <SiderPriceLibraryEntry
            isMobile={isMobile}
            isActive={pathname === '/price-library'}
            collapsed={collapsed}
            siderTooltipProps={siderTooltipProps}
            onClick={onPriceLibraryClick}
          />
          <SiderSuppliersEntry
            isMobile={isMobile}
            isActive={pathname === '/suppliers'}
            collapsed={collapsed}
            siderTooltipProps={siderTooltipProps}
            onClick={onSuppliersClick}
          />
        </div>
      ) : null}
    </div>
  );
};

export default OrgDatabaseSiderSection;
