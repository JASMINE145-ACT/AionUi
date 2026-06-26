/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { DatePicker, Form, Input, Select, Message } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import ModalWrapper from '@renderer/components/base/ModalWrapper';
import type { WorkTask, WorkTaskStatus } from '@/common/types/workTasks/workTaskTypes';
import { WORK_TASK_STATUSES, canTransitionWorkTaskStatus } from '@/common/types/workTasks/workTaskTypes';
import { WORK_TASK_STATUS_I18N_KEY } from '@/common/types/workTasks/workTaskTypes';
import { useWorkTaskMembers, useWorkTaskRole } from '@renderer/pages/workTasks/useWorkTasks';
import { useAuth } from '@renderer/hooks/context/AuthContext';

const FormItem = Form.Item;
const TextArea = Input.TextArea;
const Option = Select.Option;

interface CreateWorkTaskDialogProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: {
    title: string;
    description?: string;
    status?: WorkTaskStatus;
    assignee_id?: string;
    due_at?: number;
  }) => Promise<void>;
  editTask?: WorkTask;
}

const CreateWorkTaskDialog: React.FC<CreateWorkTaskDialogProps> = ({
  visible,
  onClose,
  onSubmit,
  editTask,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { isManager } = useWorkTaskRole();
  const { user } = useAuth();
  const { employees, loading: membersLoading } = useWorkTaskMembers();

  const selfId = user?.id ?? 'system_default_user';
  const assigneeId = Form.useWatch('assignee_id', form);
  const assigningOther = Boolean(assigneeId && assigneeId !== selfId);

  const statusOptions = useMemo(() => {
    if (editTask) {
      return WORK_TASK_STATUSES.filter(
        (status) =>
          status === editTask.status || canTransitionWorkTaskStatus(editTask.status, status)
      );
    }
    if (isManager && assigningOther) {
      return WORK_TASK_STATUSES.filter((status) => status === 'pending_accept');
    }
    return WORK_TASK_STATUSES.filter((status) => status === 'accepted');
  }, [assigningOther, editTask, isManager]);

  useEffect(() => {
    if (!visible) return;
    if (editTask) {
      form.setFieldsValue({
        title: editTask.title,
        description: editTask.description ?? '',
        status: editTask.status,
        assignee_id: editTask.assignee_id ?? selfId,
        due_at: editTask.due_at ? new Date(editTask.due_at) : undefined,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        status: 'accepted',
        assignee_id: selfId,
      });
    }
  }, [editTask, form, selfId, visible]);

  const handleOk = async () => {
    try {
      const values = await form.validate();
      const nextStatus = values.status as WorkTaskStatus | undefined;
      if (editTask && nextStatus && !canTransitionWorkTaskStatus(editTask.status, nextStatus)) {
        Message.error(t('workTasks.form.status'));
        return;
      }
      setSubmitting(true);
      const dueAtValue = values.due_at as Date | undefined;
      await onSubmit({
        title: values.title as string,
        description: (values.description as string) || undefined,
        status: values.status as WorkTaskStatus,
        assignee_id: (values.assignee_id as string) || selfId,
        due_at: dueAtValue ? dueAtValue.getTime() : undefined,
      });
      onClose();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      Message.error(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper
      visible={visible}
      title={editTask ? t('workTasks.form.edit') : t('workTasks.form.create')}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={submitting}
      okText={t('workTasks.form.save')}
      cancelText={t('workTasks.form.cancel')}
    >
      <Form form={form} layout='vertical'>
        <FormItem label={t('workTasks.form.title')} field='title' rules={[{ required: true }]}>
          <Input placeholder={t('workTasks.form.titlePlaceholder')} />
        </FormItem>
        <FormItem label={t('workTasks.form.description')} field='description'>
          <TextArea placeholder={t('workTasks.form.descriptionPlaceholder')} autoSize={{ minRows: 3 }} />
        </FormItem>
        {isManager && !editTask && (
          <FormItem label={t('workTasks.form.assignee')} field='assignee_id'>
            <Select loading={membersLoading} allowClear={false}>
              <Option value={selfId}>{t('workTasks.form.assigneeSelf')}</Option>
              {employees.map((member) => (
                <Option key={member.id} value={member.id}>
                  {member.username}
                </Option>
              ))}
            </Select>
          </FormItem>
        )}
        <FormItem label={t('workTasks.form.dueAt')} field='due_at'>
          <DatePicker showTime style={{ width: '100%' }} />
        </FormItem>
        <FormItem label={t('workTasks.form.status')} field='status'>
          <Select disabled={Boolean(isManager && assigningOther && !editTask)}>
            {statusOptions.map((status) => (
              <Option key={status} value={status}>
                {t(WORK_TASK_STATUS_I18N_KEY[status])}
              </Option>
            ))}
          </Select>
        </FormItem>
      </Form>
    </ModalWrapper>
  );
};

export default CreateWorkTaskDialog;
