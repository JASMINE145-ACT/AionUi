/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { configService } from '@/common/config/configService';
import {
  normalizeEmployeeClientProfile,
  type EmployeeClientProfile,
  type EmployeeOrgContext,
} from '@/common/config/employeeOrgContextShared';
import { fetchEmployeeOrgContext } from '@/common/config/fetchEmployeeOrgContext';
import { useAuth } from '@/renderer/hooks/context/AuthContext';
import { isElectronDesktop } from '@/renderer/utils/platform';
import { Alert, Button, Descriptions, Form, Input, Message, Spin } from '@arco-design/web-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const { TextArea } = Input;

async function syncEmployeeProfileToBackend(
  org: EmployeeOrgContext | null,
  client: EmployeeClientProfile | null
): Promise<void> {
  if (!isElectronDesktop()) {
    return;
  }
  try {
    await ipcBridge.ccbEmployeeProfileService.syncProfile.invoke({ org, client });
  } catch (error) {
    console.warn('[EmployeeProfile] syncProfile failed:', error);
  }
}

const EmployeeProfileModalContent: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [form] = Form.useForm<EmployeeClientProfile>();
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [orgContext, setOrgContext] = useState<EmployeeOrgContext | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setOrgLoading(true);
      const org = await fetchEmployeeOrgContext();
      if (!cancelled) {
        setOrgContext(org);
        setOrgLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.username]);

  useEffect(() => {
    void configService.whenReady().then(() => {
      const stored = configService.get('user.employeeProfile');
      const initial: EmployeeClientProfile = {
        addressName: stored?.addressName,
        email: stored?.email,
        phone: stored?.phone,
        notes: stored?.notes,
      };
      form.setFieldsValue(initial);
      setLoaded(true);
    });
  }, [form]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const orgForSync = orgContext ?? (await fetchEmployeeOrgContext());
      if (orgForSync && !orgContext) {
        setOrgContext(orgForSync);
      }
      const values = form.getFieldsValue();
      const normalized = normalizeEmployeeClientProfile(values);
      const payload = normalized
        ? { ...normalized, updatedAt: new Date().toISOString() }
        : null;
      await configService.set('user.employeeProfile', payload ?? undefined);
      await syncEmployeeProfileToBackend(orgForSync, payload);
      Message.success(t('settings.employeeProfile.saveSuccess'));
    } catch (error) {
      console.error('[EmployeeProfile] save failed:', error);
      Message.error(t('settings.employeeProfile.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [form, orgContext, t]);

  if (!loaded) {
    return null;
  }

  const orgReadOnly = Boolean(orgContext);

  return (
    <div className='flex flex-col gap-16px'>
      <div>
        <h2 className='text-18px font-600 text-t-primary m-0'>{t('settings.employeeProfile.title')}</h2>
        <p className='text-13px text-t-tertiary mt-8px mb-0'>{t('settings.employeeProfile.description')}</p>
      </div>

      <Alert type='info' content={t('settings.employeeProfile.privacyNote')} />
      <Alert type='warning' content={t('settings.employeeProfile.newSessionNote')} />
      {orgReadOnly ? (
        <Alert type='info' content={t('settings.employeeProfile.orgReadOnlyNote')} />
      ) : null}

      {orgLoading ? (
        <Spin />
      ) : orgContext ? (
        <Descriptions
          column={1}
          border
          title={t('settings.employeeProfile.orgSectionTitle')}
          data={[
            { label: t('settings.employeeProfile.displayName'), value: orgContext.displayName },
            { label: t('settings.employeeProfile.department'), value: orgContext.department ?? '—' },
            { label: t('settings.employeeProfile.jobTitle'), value: orgContext.jobTitle ?? '—' },
            { label: t('settings.employeeProfile.employeeId'), value: orgContext.username },
            {
              label: t('settings.employeeProfile.manager'),
              value: orgContext.managerUsername ?? '—',
            },
            {
              label: t('settings.employeeProfile.employmentStatus'),
              value: orgContext.employmentStatus,
            },
          ]}
        />
      ) : (
        <Alert type='warning' content={t('settings.employeeProfile.orgUnavailableNote')} />
      )}

      <Form form={form} layout='vertical' autoComplete='off'>
        <p className='text-14px font-500 text-t-primary m-0'>{t('settings.employeeProfile.clientSectionTitle')}</p>
        <Form.Item
          label={t('settings.employeeProfile.addressName')}
          field='addressName'
          extra={t('settings.employeeProfile.addressNameHint')}
        >
          <Input placeholder={t('settings.employeeProfile.addressNamePlaceholder')} maxLength={20} />
        </Form.Item>
        <Form.Item label={t('settings.employeeProfile.email')} field='email'>
          <Input placeholder={t('settings.employeeProfile.emailPlaceholder')} maxLength={120} />
        </Form.Item>
        <Form.Item label={t('settings.employeeProfile.phone')} field='phone'>
          <Input placeholder={t('settings.employeeProfile.phonePlaceholder')} maxLength={40} />
        </Form.Item>
        <Form.Item label={t('settings.employeeProfile.notes')} field='notes'>
          <TextArea
            placeholder={t('settings.employeeProfile.notesPlaceholder')}
            maxLength={500}
            showWordLimit
            autoSize={{ minRows: 3, maxRows: 6 }}
          />
        </Form.Item>
      </Form>

      <div className='flex justify-end'>
        <Button type='primary' loading={saving} disabled={orgLoading} onClick={() => void handleSave()}>
          {t('settings.employeeProfile.save')}
        </Button>
      </div>
    </div>
  );
};

export default EmployeeProfileModalContent;
