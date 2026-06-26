/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CCB_MINIMAX_M3_CATALOG,
  type CcbModelInfo,
} from '@/common/config/ccbModelSettingsShared';
import AionScrollArea from '@/renderer/components/base/AionScrollArea';
import {
  enrichCcbModelCatalogEntries,
  resolveCcbModelDescription,
} from '@/renderer/utils/ccbModelCatalogDisplay';
import { Spin, Tag } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

type CcbModelSettingsPanelProps = {
  modelInfo: CcbModelInfo | null;
  isPageMode: boolean;
  isLoading?: boolean;
};

const CcbModelSettingsPanel: React.FC<CcbModelSettingsPanelProps> = ({
  modelInfo,
  isPageMode,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const variants = enrichCcbModelCatalogEntries(
    modelInfo?.available_variants?.length ? modelInfo.available_variants : CCB_MINIMAX_M3_CATALOG,
    CCB_MINIMAX_M3_CATALOG[0]!
  );
  const defaultModelId = modelInfo?.model_id;

  return (
    <div className='flex flex-col bg-2 rd-16px px-16px md:px-24px lg:px-28px py-16px md:py-18px'>
      <div className='flex-shrink-0 border-b border-[var(--color-border-2)] pb-12px mb-14px flex flex-col gap-10px'>
        <div className='text-20px font-600 text-t-primary leading-34px'>{t('settings.model')}</div>
        <div
          className='rd-8px px-12px py-8px text-12px leading-5 border border-solid'
          style={{
            borderColor: 'rgba(var(--primary-6),0.32)',
            backgroundColor: 'rgba(var(--primary-6),0.08)',
            color: 'rgb(var(--primary-6))',
          }}
        >
          {t('settings.ccbModelAuthorityNote', {
            defaultValue: '模型由 CCB-Wanding settings.json 配置，此处仅展示，不可编辑。',
          })}
        </div>
      </div>

      <AionScrollArea className='flex-1 min-h-0' disableOverflow={isPageMode}>
        {isLoading ? (
          <div className='flex justify-center py-40px'>
            <Spin />
          </div>
        ) : (
          <div className='space-y-16px'>
            {variants.map((entry) => {
              const isDefault = entry.model_id === defaultModelId;
              return (
                <div
                  key={entry.model_id}
                  className='rounded-12px border border-solid border-[var(--color-border-2)] bg-[var(--color-bg-2)] p-16px'
                >
                  <div className='flex flex-wrap items-center gap-8px mb-8px'>
                    <span className='text-16px font-600 text-t-primary'>{entry.model_label}</span>
                    <span className='text-12px text-t-secondary'>{entry.model_id}</span>
                    {isDefault ? (
                      <Tag size='small' color='arcoblue'>
                        {t('settings.default', { defaultValue: '默认' })}
                      </Tag>
                    ) : null}
                    <Tag size='small' color='green'>
                      ccb-wanding
                    </Tag>
                  </div>
                  <p className='text-13px leading-20px text-t-secondary mb-12px'>
                    {resolveCcbModelDescription(entry.model_id, t)}
                  </p>
                  {(modelInfo?.base_url || modelInfo?.model_type) && (
                    <div className='text-12px text-t-secondary space-y-4px'>
                      {modelInfo?.base_url ? (
                        <div>
                          {t('settings.apiAddress', { defaultValue: 'API 地址' })}: {modelInfo.base_url}
                        </div>
                      ) : null}
                      {modelInfo?.model_type ? (
                        <div>
                          {t('settings.requestProtocol', { defaultValue: '请求协议' })}: {modelInfo.model_type}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </AionScrollArea>
    </div>
  );
};

export default CcbModelSettingsPanel;
