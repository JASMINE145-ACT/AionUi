/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  Message,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { IconPlus, IconRefresh } from '@arco-design/web-react/icon';
import { useTranslation } from 'react-i18next';
import { isBackendHttpError } from '@/common/adapter/httpBridge';
import { isOrgServerConfigured } from '@/common/adapter/orgHttpBridge';
import type { OrgUser } from '@/common/types/orgUsers/orgUserTypes';
import {
  ORG_CAPABILITY_PRICE_WRITE,
  ORG_CAPABILITY_SUPPLIER_WRITE,
} from '@/common/types/orgUsers/orgUserTypes';
import { useOrgAuth } from '@renderer/hooks/context/OrgAuthContext';
import {
  createOrgUser,
  deleteOrgUser,
  resetOrgUserPassword,
  updateOrgUser,
  useOrgUsersList,
} from '@renderer/pages/orgUsers/useOrgUsers';
import { checkOrgPassword, checkOrgUsername } from '@renderer/pages/orgUsers/orgUserFormRules';

const TABLE_HEADER_NOWRAP = { headerCellStyle: { whiteSpace: 'nowrap' as const } };

function backendErrorDetail(err: { status: number; backendMessage?: string }): string {
  const msg = err.backendMessage?.trim();
  return msg || String(err.status);
}

type FormMode = 'create' | 'edit';

type OrgUserFormValues = {
  username?: string;
  password?: string;
  department?: string;
  job_title?: string;
  work_task_role?: 'manager' | 'employee';
  manager_user_id?: string;
  employment_status?: 'active' | 'transferred' | 'suspended' | 'terminated';
  is_admin?: boolean;
  cap_price?: boolean;
  cap_supplier?: boolean;
};

type ResetPasswordFormValues = {
  password?: string;
  password_confirm?: string;
};

function capabilitiesFromForm(values: OrgUserFormValues): string[] {
  const caps: string[] = [];
  if (values.cap_price) caps.push(ORG_CAPABILITY_PRICE_WRITE);
  if (values.cap_supplier) caps.push(ORG_CAPABILITY_SUPPLIER_WRITE);
  return caps;
}

const OrgUsersPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { t } = useTranslation();
  const { configured, orgUser, orgStatus } = useOrgAuth();
  const isAdmin = Boolean(orgUser?.is_admin);
  const canLoad = configured && isAdmin && orgStatus === 'authenticated';

  const { data, error, isLoading, mutate } = useOrgUsersList(canLoad);
  const [form] = Form.useForm<OrgUserFormValues>();
  const [resetForm] = Form.useForm<ResetPasswordFormValues>();
  const [mode, setMode] = useState<FormMode>('create');
  const [editing, setEditing] = useState<OrgUser | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [resetTarget, setResetTarget] = useState<OrgUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const users = useMemo(() => {
    const list = data ?? [];
    // Until VPS ships list that includes system admin, merge current admin into the table.
    if (
      orgUser?.is_admin &&
      orgUser.id &&
      !list.some((u) => u.id === orgUser.id || u.username === orgUser.username)
    ) {
      const selfRow: OrgUser = {
        id: orgUser.id,
        username: orgUser.username,
        work_task_role: orgUser.work_task_role === 'manager' ? 'manager' : 'employee',
        is_admin: true,
        employment_status: 'active',
        capabilities: [],
      };
      return [selfRow, ...list];
    }
    return list;
  }, [data, orgUser]);
  const currentUserId = orgUser?.id;

  const confirmDelete = (row: OrgUser) => {
    if (row.id === 'system_default_user' || (currentUserId && row.id === currentUserId)) {
      Message.error(t('orgUsers.messages.cannotDeleteSelf'));
      return;
    }
    const reportsCount = users.filter((u) => u.manager_user_id === row.id).length;
    Modal.confirm({
      title: t('orgUsers.modal.deleteTitle'),
      content: t('orgUsers.modal.deleteConfirm', {
        username: row.username,
        count: reportsCount,
      }),
      okText: t('orgUsers.actions.delete'),
      okButtonProps: { status: 'danger' },
      onOk: async () => {
        setDeletingId(row.id);
        try {
          const result = await deleteOrgUser({ user_id: row.id });
          Message.success(
            t('orgUsers.messages.deleted', {
              username: result.username,
              count: result.cleared_reports_count,
            })
          );
          await mutate();
        } catch (err) {
          if (isBackendHttpError(err)) {
            Message.error(t('orgUsers.messages.deleteFailed', { detail: backendErrorDetail(err) }));
          } else {
            Message.error(t('orgUsers.messages.deleteFailedGeneric'));
          }
          throw err;
        } finally {
          setDeletingId(null);
        }
      },
    });
  };
  const managerOptions = useMemo(
    () =>
      users
        .filter((u) => (editing ? u.id !== editing.id : true))
        .map((u) => ({
          label: `${u.username}${u.department ? ` (${u.department})` : ''}`,
          value: u.id,
        })),
    [users, editing]
  );

  const openCreate = () => {
    setMode('create');
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      work_task_role: 'employee',
      employment_status: 'active',
      is_admin: false,
      cap_price: false,
      cap_supplier: false,
    });
    setModalVisible(true);
  };

  const openEdit = (user: OrgUser) => {
    setMode('edit');
    setEditing(user);
    const caps = user.capabilities ?? [];
    form.setFieldsValue({
      username: user.username,
      department: user.department ?? '',
      job_title: user.job_title ?? '',
      work_task_role: user.work_task_role,
      manager_user_id: user.manager_user_id ?? undefined,
      employment_status: (user.employment_status as OrgUserFormValues['employment_status']) || 'active',
      is_admin: Boolean(user.is_admin),
      cap_price: caps.includes(ORG_CAPABILITY_PRICE_WRITE),
      cap_supplier: caps.includes(ORG_CAPABILITY_SUPPLIER_WRITE),
    });
    setModalVisible(true);
  };

  const openResetPassword = (user: OrgUser) => {
    if (currentUserId && user.id === currentUserId) {
      Message.error(t('orgUsers.messages.cannotResetSelf'));
      return;
    }
    setResetTarget(user);
    resetForm.resetFields();
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    try {
      const values = await resetForm.validate();
      setResetting(true);
      await resetOrgUserPassword({
        user_id: resetTarget.id,
        password: values.password!,
      });
      Message.success(t('orgUsers.messages.resetPasswordOk', { username: resetTarget.username }));
      setResetTarget(null);
    } catch (err) {
      if (isBackendHttpError(err)) {
        Message.error(t('orgUsers.messages.resetPasswordFailed', { detail: backendErrorDetail(err) }));
      } else if (err instanceof Error) {
        Message.error(t('orgUsers.messages.resetPasswordFailedGeneric'));
      }
    } finally {
      setResetting(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      setSaving(true);
      const capabilities = capabilitiesFromForm(values);
      if (mode === 'create') {
        await createOrgUser({
          username: values.username!.trim(),
          password: values.password!,
          work_task_role: values.work_task_role,
          department: values.department?.trim() || undefined,
          job_title: values.job_title?.trim() || undefined,
          manager_user_id: values.manager_user_id || undefined,
          employment_status: values.employment_status,
          capabilities,
        });
        Message.success(t('orgUsers.messages.created'));
      } else if (editing) {
        await updateOrgUser({
          user_id: editing.id,
          work_task_role: values.work_task_role,
          department: values.department?.trim() ?? '',
          job_title: values.job_title?.trim() ?? '',
          manager_user_id: values.manager_user_id ?? '',
          employment_status: values.employment_status,
          capabilities,
          is_admin: Boolean(values.is_admin),
        });
        Message.success(t('orgUsers.messages.updated'));
      }
      setModalVisible(false);
      await mutate();
    } catch (err) {
      if (isBackendHttpError(err)) {
        Message.error(t('orgUsers.messages.saveFailed', { detail: backendErrorDetail(err) }));
      }
      // Arco form.validate() rejects a non-Error object — inline field errors are enough.
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      { title: t('orgUsers.columns.username'), dataIndex: 'username', width: 120, ...TABLE_HEADER_NOWRAP },
      {
        title: t('orgUsers.columns.department'),
        dataIndex: 'department',
        width: 120,
        render: (v: string | null | undefined) => v || '—',
        ...TABLE_HEADER_NOWRAP,
      },
      {
        title: t('orgUsers.columns.jobTitle'),
        dataIndex: 'job_title',
        width: 120,
        render: (v: string | null | undefined) => v || '—',
        ...TABLE_HEADER_NOWRAP,
      },
      {
        title: t('orgUsers.columns.role'),
        dataIndex: 'work_task_role',
        width: 100,
        render: (role: string, row: OrgUser) => (
          <Space size={4}>
            <Tag color={role === 'manager' ? 'arcoblue' : 'gray'}>
              {role === 'manager' ? t('orgUsers.role.manager') : t('orgUsers.role.employee')}
            </Tag>
            {row.is_admin ? <Tag color='red'>{t('orgUsers.role.admin')}</Tag> : null}
          </Space>
        ),
        ...TABLE_HEADER_NOWRAP,
      },
      {
        title: t('orgUsers.columns.capabilities'),
        dataIndex: 'capabilities',
        width: 160,
        render: (caps: string[] | undefined) => {
          const list = caps ?? [];
          if (list.length === 0) return '—';
          return (
            <Space size={4} wrap>
              {list.includes(ORG_CAPABILITY_PRICE_WRITE) ? (
                <Tag color='orangered'>{t('orgUsers.capability.priceWrite')}</Tag>
              ) : null}
              {list.includes(ORG_CAPABILITY_SUPPLIER_WRITE) ? (
                <Tag color='purple'>{t('orgUsers.capability.supplierWrite')}</Tag>
              ) : null}
            </Space>
          );
        },
        ...TABLE_HEADER_NOWRAP,
      },
      {
        title: t('orgUsers.columns.status'),
        dataIndex: 'employment_status',
        width: 100,
        render: (s: string) => t(`orgUsers.status.${s}`, { defaultValue: s }),
        ...TABLE_HEADER_NOWRAP,
      },
      {
        title: t('orgUsers.columns.actions'),
        width: 220,
        render: (_: unknown, row: OrgUser) => {
          const isSelf = Boolean(currentUserId && row.id === currentUserId);
          const isSystem = row.id === 'system_default_user';
          return (
            <Space size={4}>
              <Button type='text' size='small' onClick={() => openEdit(row)}>
                {t('orgUsers.actions.edit')}
              </Button>
              <Button type='text' size='small' disabled={isSelf} onClick={() => openResetPassword(row)}>
                {t('orgUsers.actions.resetPassword')}
              </Button>
              <Button
                type='text'
                size='small'
                status='danger'
                loading={deletingId === row.id}
                disabled={isSelf || isSystem}
                onClick={() => confirmDelete(row)}
              >
                {t('orgUsers.actions.delete')}
              </Button>
            </Space>
          );
        },
        ...TABLE_HEADER_NOWRAP,
      },
    ],
    [t, deletingId, currentUserId, users]
  );

  if (!isOrgServerConfigured() || !configured) {
    return (
      <div className='p-24px'>
        <Alert type='warning' content={t('orgUsers.alerts.notConfigured')} />
      </div>
    );
  }

  if (orgStatus === 'checking') {
    return (
      <div className='p-24px flex justify-center'>
        <Spin />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className='p-24px'>
        <Alert type='error' content={t('orgUsers.alerts.adminOnly')} />
      </div>
    );
  }

  return (
    <div className={embedded ? 'px-8px pb-16px flex flex-col gap-16px min-h-0' : 'p-24px flex flex-col gap-16px h-full min-h-0'}>
      {!embedded ? (
        <div className='flex items-start justify-between gap-12px'>
          <div>
            <Typography.Title heading={5} style={{ margin: 0 }}>
              {t('orgUsers.page.title')}
            </Typography.Title>
            <Typography.Text type='secondary'>{t('orgUsers.page.description')}</Typography.Text>
          </div>
          <Space>
            <Button icon={<IconRefresh />} onClick={() => void mutate()}>
              {t('orgUsers.actions.refresh')}
            </Button>
            <Button type='primary' icon={<IconPlus />} onClick={openCreate}>
              {t('orgUsers.actions.create')}
            </Button>
          </Space>
        </div>
      ) : (
        <div className='flex justify-end gap-8px'>
          <Button icon={<IconRefresh />} onClick={() => void mutate()}>
            {t('orgUsers.actions.refresh')}
          </Button>
          <Button type='primary' icon={<IconPlus />} onClick={openCreate}>
            {t('orgUsers.actions.create')}
          </Button>
        </div>
      )}

      {error ? (
        <Alert
          type='error'
          content={
            isBackendHttpError(error)
              ? t('orgUsers.alerts.loadFailed', { status: error.status })
              : t('orgUsers.alerts.loadFailedGeneric')
          }
        />
      ) : null}

      <Table
        rowKey='id'
        loading={isLoading}
        columns={columns}
        data={users}
        pagination={{ pageSize: 20 }}
        scroll={{ x: true }}
      />

      <Modal
        title={mode === 'create' ? t('orgUsers.modal.createTitle') : t('orgUsers.modal.editTitle')}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => void handleSubmit()}
        confirmLoading={saving}
        unmountOnExit
      >
        <Form form={form} layout='vertical'>
          <Form.Item
            label={t('orgUsers.form.username')}
            field='username'
            extra={mode === 'create' ? t('orgUsers.form.usernameHint') : undefined}
            validateTrigger={mode === 'create' ? 'onBlur' : undefined}
            rules={
              mode === 'create'
                ? [
                    {
                      validator: (value, callback) => {
                        const key = checkOrgUsername(typeof value === 'string' ? value : undefined);
                        if (key) callback(t(`orgUsers.form.${key}`));
                        else callback();
                      },
                    },
                  ]
                : undefined
            }
          >
            <Input
              autoComplete='off'
              disabled={mode === 'edit'}
              placeholder={mode === 'create' ? t('orgUsers.form.usernamePlaceholder') : undefined}
            />
          </Form.Item>
          {mode === 'create' ? (
            <Form.Item
              label={t('orgUsers.form.password')}
              field='password'
              extra={t('orgUsers.form.passwordHint')}
              validateTrigger='onBlur'
              rules={[
                {
                  validator: (value, callback) => {
                    const key = checkOrgPassword(typeof value === 'string' ? value : undefined);
                    if (key) callback(t(`orgUsers.form.${key}`));
                    else callback();
                  },
                },
              ]}
            >
              <Input.Password autoComplete='new-password' />
            </Form.Item>
          ) : null}
          <Form.Item label={t('orgUsers.form.department')} field='department'>
            <Input placeholder={t('orgUsers.form.departmentPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('orgUsers.form.jobTitle')} field='job_title'>
            <Input />
          </Form.Item>
          <Form.Item label={t('orgUsers.form.role')} field='work_task_role'>
            <Select
              options={[
                { label: t('orgUsers.role.employee'), value: 'employee' },
                { label: t('orgUsers.role.manager'), value: 'manager' },
              ]}
            />
          </Form.Item>
          <Form.Item label={t('orgUsers.form.manager')} field='manager_user_id'>
            <Select allowClear showSearch options={managerOptions} placeholder={t('orgUsers.form.managerPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('orgUsers.form.status')} field='employment_status'>
            <Select
              options={[
                { label: t('orgUsers.status.active'), value: 'active' },
                { label: t('orgUsers.status.transferred'), value: 'transferred' },
                { label: t('orgUsers.status.suspended'), value: 'suspended' },
                { label: t('orgUsers.status.terminated'), value: 'terminated' },
              ]}
            />
          </Form.Item>
          {mode === 'edit' ? (
            <Form.Item
              label={t('orgUsers.form.isAdmin')}
              field='is_admin'
              triggerPropName='checked'
              extra={t('orgUsers.form.isAdminHint')}
            >
              <Checkbox
                disabled={
                  editing?.id === 'system_default_user' ||
                  Boolean(currentUserId && editing?.id === currentUserId)
                }
              >
                {t('orgUsers.role.admin')}
              </Checkbox>
            </Form.Item>
          ) : null}
          <Form.Item label={t('orgUsers.form.capabilities')}>
            <Space direction='vertical'>
              <Form.Item field='cap_price' triggerPropName='checked' noStyle>
                <Checkbox>{t('orgUsers.capability.priceWrite')}</Checkbox>
              </Form.Item>
              <Form.Item field='cap_supplier' triggerPropName='checked' noStyle>
                <Checkbox>{t('orgUsers.capability.supplierWrite')}</Checkbox>
              </Form.Item>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('orgUsers.modal.resetPasswordTitle')}
        visible={Boolean(resetTarget)}
        onCancel={() => setResetTarget(null)}
        onOk={() => void handleResetPassword()}
        confirmLoading={resetting}
        unmountOnExit
      >
        <Typography.Paragraph type='secondary'>
          {t('orgUsers.modal.resetPasswordConfirm', { username: resetTarget?.username ?? '' })}
        </Typography.Paragraph>
        <Form form={resetForm} layout='vertical'>
          <Form.Item
            label={t('orgUsers.form.newPassword')}
            field='password'
            extra={t('orgUsers.form.passwordHint')}
            validateTrigger='onBlur'
            rules={[
              {
                validator: (value, callback) => {
                  const key = checkOrgPassword(typeof value === 'string' ? value : undefined);
                  if (key) callback(t(`orgUsers.form.${key}`));
                  else callback();
                },
              },
            ]}
          >
            <Input.Password autoComplete='new-password' />
          </Form.Item>
          <Form.Item
            label={t('orgUsers.form.newPasswordConfirm')}
            field='password_confirm'
            validateTrigger='onBlur'
            rules={[
              {
                validator: (value, callback) => {
                  if (value !== resetForm.getFieldValue('password')) {
                    callback(t('orgUsers.form.passwordMismatch'));
                  } else {
                    callback();
                  }
                },
              },
            ]}
          >
            <Input.Password autoComplete='new-password' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OrgUsersPage;
