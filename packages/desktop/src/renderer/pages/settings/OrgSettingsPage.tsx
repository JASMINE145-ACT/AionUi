/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Tabs } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import OrgUsersPage from '@renderer/pages/orgUsers/OrgUsersPage';
import OrgStructurePanel from '@renderer/pages/orgUsers/OrgStructurePanel';
import './orgSettingsTabs.css';

const OrgSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get('tab') === 'structure' ? 'structure' : 'users';
  const [tab, setTab] = useState(initial);

  useEffect(() => {
    const next = searchParams.get('tab') === 'structure' ? 'structure' : 'users';
    setTab(next);
  }, [searchParams]);

  return (
    <div className='h-full min-h-0 flex flex-col'>
      <Tabs
        activeTab={tab}
        onChange={(key) => {
          setTab(key);
          setSearchParams(key === 'structure' ? { tab: 'structure' } : {}, { replace: true });
        }}
        className='px-16px pt-8px h-full min-h-0 flex flex-col org-settings-tabs'
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <Tabs.TabPane key='users' title={t('orgUsers.tabs.users')}>
          <div className='h-full min-h-0 overflow-auto'>
            <OrgUsersPage embedded />
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane key='structure' title={t('orgUsers.tabs.structure')}>
          <div className='h-full min-h-0 flex flex-col'>
            <OrgStructurePanel />
          </div>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default OrgSettingsPage;
