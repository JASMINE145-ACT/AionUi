/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Input,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { IconRefresh } from '@arco-design/web-react/icon';
import { useTranslation } from 'react-i18next';
import { isBackendHttpError } from '@/common/adapter/httpBridge';
import { isOrgServerConfigured } from '@/common/adapter/orgHttpBridge';
import {
  PRICE_LIBRARY_COLUMNS,
  type PriceVersionItem,
} from '@/common/types/priceLibrary/priceLibraryTypes';
import { useOrgAuth } from '@renderer/hooks/context/OrgAuthContext';
import { filterPriceProducts, formatPriceCell } from '@renderer/pages/priceLibrary/filterProducts';
import { usePriceLibraryActive } from '@renderer/pages/priceLibrary/usePriceLibrary';

function formatCellValue(
  value: string | number | boolean | null | undefined,
  isNumeric?: boolean
): string {
  if (value == null || value === '') {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? '✓' : '—';
  }
  if (isNumeric && typeof value === 'number') {
    return formatPriceCell(value);
  }
  return String(value);
}

const PriceLibraryPage: React.FC = () => {
  const { t } = useTranslation();
  const { configured, orgUser } = useOrgAuth();
  const { data, error, isLoading, mutate } = usePriceLibraryActive();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const filtered = useMemo(
    () => filterPriceProducts(data?.products ?? [], search),
    [data?.products, search]
  );

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const columns = useMemo(
    () =>
      PRICE_LIBRARY_COLUMNS.map((col) => ({
        title: t(col.titleKey),
        dataIndex: col.key,
        width: col.width,
        ellipsis: col.key === 'description' || col.key === 'raw_json',
        fixed: col.key === 'material_code' ? ('left' as const) : undefined,
        render: (v: string | number | boolean | null | undefined) =>
          formatCellValue(v, col.isNumeric),
      })),
    [t]
  );

  if (!configured || !isOrgServerConfigured()) {
    return (
      <div className='p-24px'>
        <Alert type='warning' content={t('priceLibrary.unconfigured')} />
      </div>
    );
  }

  return (
    <div className='p-16px flex flex-col h-full min-h-0'>
      <div className='mb-10px flex items-center justify-between gap-8px flex-shrink-0 flex-wrap'>
        <Space size='small' align='center'>
          <Typography.Title heading={6} style={{ margin: 0 }}>
            {t('priceLibrary.pageTitle')}
          </Typography.Title>
          {data?.version && (
            <Tag color='arcoblue' size='small'>
              {t('priceLibrary.versionTag', { n: data.version.version_number })}
            </Tag>
          )}
          {orgUser && (
            <Tag color='green' size='small'>
              {t('priceLibrary.loggedInAs', { user: orgUser.username })}
            </Tag>
          )}
        </Space>
        <Button
          size='small'
          icon={<IconRefresh />}
          loading={isLoading}
          onClick={() => void mutate()}
        >
          {t('priceLibrary.refresh')}
        </Button>
      </div>

      {isLoading && !data ? (
        <div className='flex-1 flex items-center justify-center'>
          <Spin />
        </div>
      ) : error ? (
        <Alert
          type='error'
          title={t('priceLibrary.loadFailed')}
          content={
            isBackendHttpError(error) && error.status === 404
              ? t('priceLibrary.loadFailed404')
              : error instanceof Error
                ? error.message
                : String(error)
          }
        />
      ) : !data?.version ? (
        <Alert type='info' content={t('priceLibrary.emptyPublished')} />
      ) : (
        <>
          <div className='mb-8px flex-shrink-0 flex gap-8px items-center'>
            <Input.Search
              allowClear
              placeholder={t('priceLibrary.searchPlaceholder')}
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              style={{ maxWidth: 360 }}
            />
            <Typography.Text type='secondary' className='text-13px'>
              {t('priceLibrary.resultCount', { count: filtered.length })}
            </Typography.Text>
            <Typography.Text type='secondary' className='text-12px'>
              {t('priceLibrary.columnCount', { count: PRICE_LIBRARY_COLUMNS.length })}
            </Typography.Text>
          </div>
          <Table<PriceVersionItem>
            className='flex-1 min-h-0'
            rowKey='id'
            loading={isLoading}
            columns={columns}
            data={paged}
            scroll={{ x: 5200, y: 'calc(100vh - 220px)' }}
            pagination={{
              current: page,
              pageSize,
              total: filtered.length,
              showTotal: true,
              onChange: (p) => setPage(p),
            }}
          />
        </>
      )}
    </div>
  );
};

export default PriceLibraryPage;
