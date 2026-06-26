/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button, Form, Input, Message, Select, Table } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { auth } from '@/common/adapter/ipcBridge';
import { isBackendHttpError } from '@/common/adapter/httpBridge';
import type { WorkTaskMember, WorkTaskRole } from '@/common/types/workTasks/workTaskTypes';
import { isWorkTaskManager } from '@/common/types/workTasks/workTaskTypes';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const TeamMembersPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [members, setMembers] = useState<WorkTaskMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  const isManager = isWorkTaskManager(user?.work_task_role ?? 'employee');

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await auth.listUsers.invoke();
      setMembers(list);
    } catch (error) {
      console.error('Failed to load team members:', error);
      Message.error(t('teamMembers.loadFailed', { defaultValue: 'Failed to load team members' }));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isManager) {
      void loadMembers();
    }
  }, [isManager, loadMembers]);

  if (!isManager) {
    return <Navigate to='/settings/model' replace />;
  }

  const handleCreate = async () => {
    try {
      const values = await form.validate();
      setCreating(true);
      await auth.createUser.invoke({
        username: values.username.trim(),
        password: values.password,
        work_task_role: values.work_task_role as WorkTaskRole,
      });
      Message.success(t('teamMembers.createSuccess', { defaultValue: 'Member created' }));
      form.resetFields();
      form.setFieldValue('work_task_role', 'employee');
      await loadMembers();
    } catch (error) {
      if ((error as { errorFields?: unknown }).errorFields) {
        return;
      }
      console.error('Create member failed:', error);
      Message.error(t('teamMembers.createFailed', { defaultValue: 'Failed to create member' }));
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: WorkTaskRole) => {
    try {
      await auth.updateWorkTaskRole.invoke({ userId: memberId, work_task_role: role });
      Message.success(t('teamMembers.roleUpdated', { defaultValue: 'Role updated' }));
      await loadMembers();
    } catch (error) {
      console.error('Update role failed:', error);
      if (isBackendHttpError(error) && error.code === 'CONFLICT') {
        Message.error(t('teamMembers.lastManager', { defaultValue: 'Cannot demote the last manager' }));
      } else {
        Message.error(t('teamMembers.roleUpdateFailed', { defaultValue: 'Failed to update role' }));
      }
    }
  };

  const roleLabel = (role: WorkTaskRole) =>
    role === 'manager'
      ? t('workTasks.roleManager', { defaultValue: 'Manager' })
      : t('workTasks.roleEmployee', { defaultValue: 'Employee' });

  return (
    <SettingsPageWrapper>
      <div className='flex flex-col gap-16px max-w-720px'>
        <div>
          <h2 className='text-18px font-600 m-0 mb-4px'>{t('teamMembers.title', { defaultValue: 'Team members' })}</h2>
          <p className='text-13px text-t-secondary m-0'>
            {t('teamMembers.subtitle', { defaultValue: 'Create accounts and assign manager or employee roles.' })}
          </p>
        </div>

        <Form form={form} layout='vertical' initialValues={{ work_task_role: 'employee' }}>
          <Form.Item
            label={t('teamMembers.username', { defaultValue: 'Username' })}
            field='username'
            rules={[{ required: true, message: t('teamMembers.usernameRequired', { defaultValue: 'Username is required' }) }]}
          >
            <Input placeholder='user_name' autoComplete='off' />
          </Form.Item>
          <Form.Item
            label={t('teamMembers.initialPassword', { defaultValue: 'Initial password' })}
            field='password'
            rules={[{ required: true, message: t('teamMembers.passwordRequired', { defaultValue: 'Password is required' }) }]}
          >
            <Input.Password autoComplete='new-password' />
          </Form.Item>
          <Form.Item label={t('teamMembers.role', { defaultValue: 'Role' })} field='work_task_role'>
            <Select
              options={[
                { label: roleLabel('employee'), value: 'employee' },
                { label: roleLabel('manager'), value: 'manager' },
              ]}
            />
          </Form.Item>
          <Button type='primary' loading={creating} onClick={() => void handleCreate()}>
            {t('teamMembers.create', { defaultValue: 'Create member' })}
          </Button>
        </Form>

        <Table
          loading={loading}
          rowKey='id'
          pagination={false}
          columns={[
            {
              title: t('teamMembers.username', { defaultValue: 'Username' }),
              dataIndex: 'username',
            },
            {
              title: t('teamMembers.role', { defaultValue: 'Role' }),
              dataIndex: 'work_task_role',
              render: (role: WorkTaskRole, record: WorkTaskMember) => (
                <Select
                  size='small'
                  value={role}
                  style={{ width: 140 }}
                  onChange={(value) => void handleRoleChange(record.id, value as WorkTaskRole)}
                  options={[
                    { label: roleLabel('employee'), value: 'employee' },
                    { label: roleLabel('manager'), value: 'manager' },
                  ]}
                />
              ),
            },
          ]}
          data={members}
        />
      </div>
    </SettingsPageWrapper>
  );
};

export default TeamMembersPage;
