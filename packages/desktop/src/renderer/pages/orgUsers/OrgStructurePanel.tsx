/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Alert, Empty, Spin, Typography } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { useOrgAuth } from '@renderer/hooks/context/OrgAuthContext';
import OrgStructureChart from '@renderer/pages/orgUsers/OrgStructureChart';
import { useOrgUsersList } from '@renderer/pages/orgUsers/useOrgUsers';

const OrgStructurePanel: React.FC = () => {
  const { t } = useTranslation();
  const { configured, orgUser, orgStatus } = useOrgAuth();
  const isAdmin = Boolean(orgUser?.is_admin);
  const canLoad = configured && isAdmin && orgStatus === 'authenticated';
  const { data, isLoading, error } = useOrgUsersList(canLoad);

  if (!isAdmin) {
    return (
      <div className='p-16px'>
        <Alert type='error' content={t('orgUsers.alerts.adminOnly')} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='flex justify-center p-24px'>
        <Spin />
      </div>
    );
  }

  if (error) {
    return <Typography.Text type='error'>{t('orgUsers.alerts.loadFailedGeneric')}</Typography.Text>;
  }

  if (!data || data.length === 0) {
    return <Empty description={t('orgUsers.structure.empty')} />;
  }

  return (
    <div className='h-full min-h-0 flex flex-col px-16px pb-16px gap-8px'>
      <div className='shrink-0'>
        <Typography.Title heading={6} className='!m-0 !text-18px !font-600'>
          {t('orgUsers.structure.title')}
        </Typography.Title>
        <Typography.Text type='secondary' className='block mt-6px text-13px leading-relaxed'>
          {t('orgUsers.structure.hint')}
        </Typography.Text>
      </div>
      <OrgStructureChart users={data} />
    </div>
  );
};

export default OrgStructurePanel;
