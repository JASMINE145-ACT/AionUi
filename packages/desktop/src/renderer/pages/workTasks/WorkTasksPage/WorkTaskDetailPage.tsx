/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import classNames from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Message, Select, Spin, Modal, Descriptions } from '@arco-design/web-react';
import { Download } from '@icon-park/react';
import { ipcBridge } from '@/common';
import type { WorkTaskAttachment, WorkTaskStatus } from '@/common/types/workTasks/workTaskTypes';
import {
  WORK_TASK_STATUSES,
  WORK_TASK_STATUS_I18N_KEY,
  canOpenWorkTaskAttachment,
  canTransitionWorkTaskStatus,
  getWorkTaskAttachmentStorageMode,
  isWorkTaskOverdue,
} from '@/common/types/workTasks/workTaskTypes';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import { isElectronDesktop } from '@renderer/utils/platform';
import { downloadFileFromPath } from '@renderer/utils/file/download';
import { useWorkTask } from '@renderer/pages/workTasks/useWorkTasks';
import WorkTaskStatusTag from '@renderer/pages/workTasks/components/WorkTaskStatusTag';
import WorkTaskSourceTag from '@renderer/pages/workTasks/components/WorkTaskSourceTag';
import CreateWorkTaskDialog from '@renderer/pages/workTasks/components/CreateWorkTaskDialog';
import {
  deleteLocalWorkTaskAttachmentBlob,
  hasLocalWorkTaskAttachmentBlob,
  resolveLocalWorkTaskAttachmentPath,
  storeWorkTaskAttachmentBlob,
} from '@renderer/services/workTaskAttachmentStore';

const WorkTaskDetailPage: React.FC = () => {
  const { task_id } = useParams<{ task_id: string }>();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localBlobIds, setLocalBlobIds] = useState<Set<string>>(new Set());

  const { task, loading, mutate } = useWorkTask(task_id);

  useEffect(() => {
    if (!task?.attachments.length || !isElectronDesktop()) {
      setLocalBlobIds(new Set());
      return;
    }

    let cancelled = false;
    void (async () => {
      const ids = new Set<string>();
      for (const att of task.attachments) {
        if (await hasLocalWorkTaskAttachmentBlob(att.id)) {
          ids.add(att.id);
        }
      }
      if (!cancelled) {
        setLocalBlobIds(ids);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [task?.attachments]);

  const handleAccept = useCallback(async () => {
    if (!task_id || !task) return;
    await ipcBridge.workTask.updateTask.invoke({ task_id, updates: { status: 'accepted' } });
    await mutate();
    Message.success(t('workTasks.message.updateSuccess'));
  }, [mutate, t, task, task_id]);

  const handleStatusChange = useCallback(
    async (status: WorkTaskStatus) => {
      if (!task_id || !task) return;
      if (!canTransitionWorkTaskStatus(task.status, status)) {
        Message.warning(t('workTasks.form.status'));
        return;
      }
      await ipcBridge.workTask.updateTask.invoke({ task_id, updates: { status } });
      await mutate();
      Message.success(t('workTasks.message.updateSuccess'));
    },
    [mutate, t, task, task_id]
  );

  const handleDelete = useCallback(() => {
    if (!task_id) return;
    Modal.confirm({
      title: t('workTasks.detail.deleteConfirm'),
      onOk: async () => {
        if (task?.attachments.length) {
          await Promise.all(task.attachments.map((att) => deleteLocalWorkTaskAttachmentBlob(att.id).catch(() => undefined)));
        }
        await ipcBridge.workTask.deleteTask.invoke({ task_id });
        Message.success(t('workTasks.message.deleteSuccess'));
        navigate('/tasks');
      },
    });
  }, [navigate, t, task?.attachments, task_id]);

  const handleFilePick = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || !task_id) return;

      if (!isElectronDesktop()) {
        Message.warning(t('workTasks.message.localAttachmentDesktopOnly'));
        return;
      }

      setUploading(true);
      let createdAttachmentId: string | null = null;
      try {
        const updated = await ipcBridge.workTask.addAttachment.invoke({
          task_id,
          file_name: file.name,
          mime_type: file.type || undefined,
          size: file.size,
          storage_mode: 'local',
        });
        const created = updated.attachments.reduce<WorkTaskAttachment | undefined>((latest, item) => {
          if (!latest || item.created_at > latest.created_at) {
            return item;
          }
          return latest;
        }, undefined);
        if (!created) {
          throw new Error('Attachment metadata was not returned');
        }
        createdAttachmentId = created.id;
        await storeWorkTaskAttachmentBlob(created.id, file);
        setLocalBlobIds((prev) => new Set(prev).add(created.id));
        await mutate();
        Message.success(t('workTasks.message.attachmentAdded'));
      } catch (err) {
        if (createdAttachmentId) {
          await ipcBridge.workTask.removeAttachment
            .invoke({ task_id, attachment_id: createdAttachmentId })
            .catch(() => undefined);
          await deleteLocalWorkTaskAttachmentBlob(createdAttachmentId).catch(() => undefined);
        }
        Message.error(String(err));
      } finally {
        setUploading(false);
      }
    },
    [mutate, t, task_id]
  );

  const handleRemoveAttachment = useCallback(
    async (attachment_id: string) => {
      if (!task_id) return;
      await ipcBridge.workTask.removeAttachment.invoke({ task_id, attachment_id });
      await deleteLocalWorkTaskAttachmentBlob(attachment_id).catch(() => undefined);
      setLocalBlobIds((prev) => {
        const next = new Set(prev);
        next.delete(attachment_id);
        return next;
      });
      await mutate();
      Message.success(t('workTasks.message.attachmentRemoved'));
    },
    [mutate, t, task_id]
  );

  const handleOpenAttachment = useCallback(
    async (att: WorkTaskAttachment) => {
      const canOpen = canOpenWorkTaskAttachment(att, user?.id, localBlobIds.has(att.id));
      if (!canOpen) {
        Message.info(t('workTasks.message.localAttachmentUnavailable'));
        return;
      }

      try {
        if (getWorkTaskAttachmentStorageMode(att) === 'remote' && att.file_path?.trim()) {
          if (isElectronDesktop()) {
            await ipcBridge.shell.openFile.invoke(att.file_path);
          } else {
            await downloadFileFromPath(att.file_path, att.file_name);
          }
          return;
        }

        const localPath = await resolveLocalWorkTaskAttachmentPath(att.id);
        if (!localPath) {
          Message.info(t('workTasks.message.localAttachmentUnavailable'));
          return;
        }
        if (isElectronDesktop()) {
          await ipcBridge.shell.openFile.invoke(localPath);
        } else {
          await downloadFileFromPath(localPath, att.file_name);
        }
      } catch (err) {
        Message.error(t('workTasks.message.openAttachmentFailed', { defaultValue: 'Failed to open attachment' }));
        console.error('Open attachment failed:', err);
      }
    },
    [localBlobIds, t, user?.id]
  );

  const handleDownloadAttachment = useCallback(
    async (att: WorkTaskAttachment) => {
      const canOpen = canOpenWorkTaskAttachment(att, user?.id, localBlobIds.has(att.id));
      if (!canOpen) {
        Message.info(t('workTasks.message.localAttachmentUnavailable'));
        return;
      }

      try {
        if (getWorkTaskAttachmentStorageMode(att) === 'remote' && att.file_path?.trim()) {
          await downloadFileFromPath(att.file_path, att.file_name);
          return;
        }

        const localPath = await resolveLocalWorkTaskAttachmentPath(att.id);
        if (!localPath) {
          Message.info(t('workTasks.message.localAttachmentUnavailable'));
          return;
        }
        await downloadFileFromPath(localPath, att.file_name);
      } catch (err) {
        Message.error(t('workTasks.message.downloadAttachmentFailed', { defaultValue: 'Failed to download attachment' }));
        console.error('Download attachment failed:', err);
      }
    },
    [localBlobIds, t, user?.id]
  );

  const handleEdit = useCallback(
    async (values: { title: string; description?: string; status?: WorkTaskStatus }) => {
      if (!task_id) return;
      await ipcBridge.workTask.updateTask.invoke({
        task_id,
        updates: {
          title: values.title,
          description: values.description ?? null,
          status: values.status,
        },
      });
      await mutate();
      Message.success(t('workTasks.message.updateSuccess'));
    },
    [mutate, t, task_id]
  );

  if (loading) {
    return (
      <div className='flex justify-center py-40px'>
        <Spin />
      </div>
    );
  }

  if (!task) {
    return (
      <div className='p-24px'>
        <Button onClick={() => navigate('/tasks')}>{t('workTasks.page.backToAll')}</Button>
      </div>
    );
  }

  const allowedStatuses = WORK_TASK_STATUSES.filter(
    (s) => s !== task.status && canTransitionWorkTaskStatus(task.status, s)
  );

  return (
    <div
      className={classNames(
        'w-full min-h-full box-border overflow-y-auto',
        isMobile ? 'px-16px py-14px' : 'px-12px py-24px md:px-40px md:py-32px'
      )}
    >
      <div className='mx-auto max-w-800px flex flex-col gap-16px'>
        <Button type='text' onClick={() => navigate('/tasks')}>
          ← {t('workTasks.page.backToAll')}
        </Button>

        <div className='flex items-start justify-between gap-12px'>
          <div>
            <h1 className='m-0 text-24px font-bold text-t-primary'>{task.title}</h1>
            <div className='mt-8px flex items-center gap-6px'>
              <WorkTaskStatusTag status={task.status} />
              <WorkTaskSourceTag task={task} />
            </div>
          </div>
          <div className='flex gap-8px shrink-0'>
            <Button onClick={() => setEditVisible(true)}>{t('workTasks.form.edit')}</Button>
            <Button status='danger' onClick={handleDelete}>
              {t('workTasks.detail.delete')}
            </Button>
          </div>
        </div>

        {task.description ? <p className='text-14px text-t-secondary whitespace-pre-wrap'>{task.description}</p> : null}

        <Descriptions
          column={1}
          size='small'
          data={[
            {
              label: t('workTasks.form.assignee'),
              value: task.assignee?.username ?? task.assignee_id ?? '—',
            },
            {
              label: t('workTasks.detail.creator'),
              value: task.created_by?.username ?? task.created_by_id,
            },
            {
              label: t('workTasks.form.dueAt'),
              value: task.due_at
                ? `${new Date(task.due_at).toLocaleString()}${isWorkTaskOverdue(task) ? ` (${t('workTasks.card.overdue')})` : ''}`
                : '—',
            },
          ]}
        />

        {task.status === 'pending_accept' && canTransitionWorkTaskStatus(task.status, 'accepted') && (
          <Button type='primary' onClick={() => void handleAccept()}>
            {t('workTasks.action.accept')}
          </Button>
        )}

        {allowedStatuses.length > 0 && (
          <div className='flex items-center gap-8px flex-wrap'>
            <span className='text-14px text-t-secondary'>{t('workTasks.detail.changeStatus')}</span>
            <Select
              placeholder={t('workTasks.form.status')}
              style={{ width: 160 }}
              onChange={(value) => void handleStatusChange(value as WorkTaskStatus)}
              triggerProps={{ autoAlignPopupWidth: false }}
            >
              {allowedStatuses.map((status) => (
                <Select.Option key={status} value={status}>
                  {t(WORK_TASK_STATUS_I18N_KEY[status])}
                </Select.Option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <div className='flex items-center justify-between mb-8px'>
            <h2 className='m-0 text-16px font-600'>{t('workTasks.detail.attachments')}</h2>
            <Button loading={uploading} onClick={() => fileInputRef.current?.click()}>
              {t('workTasks.detail.addAttachment')}
            </Button>
            <input ref={fileInputRef} type='file' className='hidden' onChange={handleFilePick} />
          </div>
          <p className='text-12px text-t-tertiary m-0 mb-8px'>{t('workTasks.detail.localAttachmentHint')}</p>
          {task.attachments.length === 0 ? (
            <p className='text-t-secondary text-14px'>{t('workTasks.detail.noAttachments')}</p>
          ) : (
            <ul className='list-none p-0 m-0 flex flex-col gap-8px'>
              {task.attachments.map((att) => {
                const canOpen = canOpenWorkTaskAttachment(att, user?.id, localBlobIds.has(att.id));
                return (
                  <li
                    key={att.id}
                    className='flex items-center justify-between gap-8px rd-8px bg-fill-2 px-12px py-8px'
                  >
                    <button
                      type='button'
                      disabled={!canOpen}
                      className={classNames(
                        'truncate text-14px text-left min-w-0 flex-1 bg-transparent border-0 p-0',
                        canOpen
                          ? 'text-t-primary hover:text-primary-6 cursor-pointer'
                          : 'text-t-secondary cursor-default'
                      )}
                      title={
                        canOpen
                          ? isElectronDesktop()
                            ? t('workTasks.detail.openAttachment', { defaultValue: 'Open' })
                            : t('workTasks.detail.downloadAttachment', { defaultValue: 'Download' })
                          : t('workTasks.detail.localAttachmentMetadataOnly')
                      }
                      onClick={() => void handleOpenAttachment(att)}
                    >
                      {att.file_name}
                    </button>
                    <div className='flex items-center gap-4px shrink-0'>
                      {canOpen && isElectronDesktop() ? (
                        <Button
                          size='mini'
                          type='text'
                          icon={<Download theme='outline' size='14' />}
                          title={t('workTasks.detail.downloadAttachment', { defaultValue: 'Download' })}
                          onClick={() => void handleDownloadAttachment(att)}
                        />
                      ) : null}
                      <Button size='mini' status='danger' onClick={() => void handleRemoveAttachment(att.id)}>
                        ×
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <CreateWorkTaskDialog
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        onSubmit={handleEdit}
        editTask={task}
      />
    </div>
  );
};

export default WorkTaskDetailPage;
