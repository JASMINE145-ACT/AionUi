/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { configService } from '@/common/config/configService';
import {
  isEmployeeProfileEmpty,
  normalizeEmployeeProfile,
  type EmployeeProfile,
} from '@/common/config/employeeProfileShared';
import { useAuth } from '@/renderer/hooks/context/AuthContext';
import { isElectronDesktop } from '@/renderer/utils/platform';
import { Alert, Button, Form, Input, Message } from '@arco-design/web-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const { TextArea } = Input;

async function syncEmployeeProfileToBackend(profile: EmployeeProfile | null): Promise<void> {
  if (!isElectronDesktop()) {
    return;
  }
  try {
    await ipcBridge.ccbEmployeeProfileService.syncProfile.invoke({ profile });
  } catch (error) {
    console.warn('[EmployeeProfile] syncProfile failed:', error);
  }
}

const EmployeeProfileModalContent: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [form] = Form.useForm<EmployeeProfile>();
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void configService.whenReady().then(() => {
      const stored = configService.get('user.employeeProfile');
      const initial: EmployeeProfile = stored ?? {};
      if (!initial.displayName?.trim() && user?.username?.trim()) {
        initial.displayName = user.username.trim();
      }
      form.setFieldsValue(initial);
      setLoaded(true);
    });
  }, [form, user?.username]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const values = form.getFieldsValue();
      const normalized = normalizeEmployeeProfile(values);
      const payload = normalized
        ? { ...normalized, updatedAt: new Date().toISOString() }
        : null;
      await configService.set('user.employeeProfile', payload ?? undefined);
      await syncEmployeeProfileToBackend(payload);
      Message.success(t('settings.employeeProfile.saveSuccess'));
    } catch (error) {
      console.error('[EmployeeProfile] save failed:', error);
      Message.error(t('settings.employeeProfile.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [form, t]);

  if (!loaded) {
    return null;
  }

  return (
    <div className='flex flex-col gap-16px'>
      <div>
        <h2 className='text-18px font-600 text-t-primary m-0'>{t('settings.employeeProfile.title')}</h2>
        <p className='text-13px text-t-tertiary mt-8px mb-0'>{t('settings.employeeProfile.description')}</p>
      </div>

      <Alert type='info' content={t('settings.employeeProfile.privacyNote')} />
      <Alert type='warning' content={t('settings.employeeProfile.newSessionNote')} />

      <Form form={form} layout='vertical' autoComplete='off'>
        <Form.Item label={t('settings.employeeProfile.displayName')} field='displayName'>
          <Input placeholder={t('settings.employeeProfile.displayNamePlaceholder')} maxLength={80} />
        </Form.Item>
        <Form.Item
          label={t('settings.employeeProfile.addressName')}
          field='addressName'
          extra={t('settings.employeeProfile.addressNameHint')}
        >
          <Input placeholder={t('settings.employeeProfile.addressNamePlaceholder')} maxLength={20} />
        </Form.Item>
        <Form.Item label={t('settings.employeeProfile.department')} field='department'>
          <Input placeholder={t('settings.employeeProfile.departmentPlaceholder')} maxLength={80} />
        </Form.Item>
        <Form.Item label={t('settings.employeeProfile.jobTitle')} field='jobTitle'>
          <Input placeholder={t('settings.employeeProfile.jobTitlePlaceholder')} maxLength={80} />
        </Form.Item>
        <Form.Item label={t('settings.employeeProfile.employeeId')} field='employeeId'>
          <Input placeholder={t('settings.employeeProfile.employeeIdPlaceholder')} maxLength={40} />
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
        <Button type='primary' loading={saving} onClick={() => void handleSave()}>
          {t('settings.employeeProfile.save')}
        </Button>
      </div>

      {isEmployeeProfileEmpty(form.getFieldsValue()) && (
        <p className='text-12px text-t-tertiary m-0'>{t('settings.employeeProfile.emptyHint')}</p>
      )}
    </div>
  );
};

export default EmployeeProfileModalContent;
