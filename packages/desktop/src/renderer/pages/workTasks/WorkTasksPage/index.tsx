/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import classNames from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Collapse, Empty, Message, Select, Spin, Tabs, Alert, Tag } from '@arco-design/web-react';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import type { WorkTask, WorkTaskScope, WorkTaskStatus } from '@/common/types/workTasks/workTaskTypes';
import {
  WORK_TASK_SCOPE_I18N_KEY,
  WORK_TASK_STATUS_I18N_KEY,
  WORK_TASK_STATUSES,
  canTransitionWorkTaskStatus,
  isWorkTaskOverdue,
} from '@/common/types/workTasks/workTaskTypes';
import {
  useWorkTaskQuery,
  useWorkTaskRole,
  useWorkTasks,
} from '@renderer/pages/workTasks/useWorkTasks';
import WorkTaskStatusTag from '@renderer/pages/workTasks/components/WorkTaskStatusTag';
import WorkTaskSourceTag from '@renderer/pages/workTasks/components/WorkTaskSourceTag';
import CreateWorkTaskDialog from '@renderer/pages/workTasks/components/CreateWorkTaskDialog';

const CollapseItem = Collapse.Item;

const WorkTasksPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isManager } = useWorkTaskRole();
  const [scopeTab, setScopeTab] = useState<WorkTaskScope>('visible');
  const [statusFilter, setStatusFilter] = useState<WorkTaskStatus | 'all'>('all');
  const [dialogVisible, setDialogVisible] = useState(false);

  const { tasks, loading, apiUnavailable, createTask, updateTask } = useWorkTasks({
    scope: scopeTab,
    statusFilter: statusFilter === 'all' ? undefined : statusFilter,
  });
  const { query, loading: queryLoading } = useWorkTaskQuery(isManager);

  const scopeTabs = useMemo(() => {
    const scopes: WorkTaskScope[] = isManager
      ? ['visible', 'mine', 'assigned']
      : ['visible', 'mine'];
    return scopes.map((scope) => ({
      key: scope,
      label: t(WORK_TASK_SCOPE_I18N_KEY[scope]),
    }));
  }, [isManager, t]);

  const handleCreate = useCallback(
    async (values: {
      title: string;
      description?: string;
      status?: WorkTaskStatus;
      assignee_id?: string;
      due_at?: number;
    }) => {
      await createTask({
        title: values.title,
        description: values.description,
        status: values.status,
        assignee_id: values.assignee_id,
        due_at: values.due_at,
      });
      Message.success(t('workTasks.message.createSuccess'));
    },
    [createTask, t]
  );

  const handleQuickAccept = useCallback(
    async (task: WorkTask, event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      if (!canTransitionWorkTaskStatus(task.status, 'accepted')) return;
      await updateTask(task.id, { status: 'accepted' });
      Message.success(t('workTasks.message.updateSuccess'));
    },
    [t, updateTask]
  );

  const handleQuickComplete = useCallback(
    async (task: WorkTask, event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      if (!canTransitionWorkTaskStatus(task.status, 'completed')) return;
      await updateTask(task.id, { status: 'completed' });
      Message.success(t('workTasks.message.updateSuccess'));
    },
    [t, updateTask]
  );

  const formatDue = (dueAt?: number) => {
    if (!dueAt) return null;
    return new Date(dueAt).toLocaleString();
  };

  return (
    <div
      className={classNames(
        'w-full min-h-full box-border overflow-y-auto',
        isMobile ? 'px-16px py-14px' : 'px-12px py-24px md:px-40px md:py-32px'
      )}
    >
      <div className={classNames('mx-auto flex w-full max-w-800px flex-col', isMobile ? 'gap-14px' : 'gap-16px')}>
        <div className='flex items-start justify-between gap-12px'>
          <div>
            <h1 className='m-0 text-28px font-bold text-t-primary'>{t('workTasks.page.title')}</h1>
            <p className='mt-8px mb-0 text-14px text-t-secondary'>{t('workTasks.page.description')}</p>
          </div>
          <Button type='primary' shape='round' onClick={() => setDialogVisible(true)} disabled={apiUnavailable}>
            {t('workTasks.page.newTask')}
          </Button>
        </div>

        {apiUnavailable && (
          <Alert
            type='warning'
            title={t('workTasks.page.apiUnavailable')}
            content={t('workTasks.page.apiUnavailableHint')}
          />
        )}

        {isManager && !apiUnavailable && (
          <Collapse bordered={false} defaultActiveKey={[]}>
            <CollapseItem header={t('workTasks.overview.title')} name='overview'>
              {queryLoading ? (
                <Spin />
              ) : query ? (
                <div className='flex flex-col gap-10px text-14px'>
                  <div className='flex flex-wrap gap-8px'>
                    <Tag>{t('workTasks.overview.total', { count: query.summary.total })}</Tag>
                    <Tag color='orangered'>
                      {t('workTasks.overview.pending', { count: query.summary.pending_accept })}
                    </Tag>
                    <Tag color='arcoblue'>{t('workTasks.overview.accepted', { count: query.summary.accepted })}</Tag>
                    <Tag color='green'>{t('workTasks.overview.completed', { count: query.summary.completed })}</Tag>
                    {query.summary.overdue_count > 0 && (
                      <Tag color='red'>
                        {t('workTasks.overview.overdue', { count: query.summary.overdue_count })}
                      </Tag>
                    )}
                  </div>
                  {query.summary.overdue_count > 0 && (
                    <div className='flex flex-col gap-6px'>
                      <span className='text-t-secondary'>{t('workTasks.overview.overdueList')}</span>
                      {query.items
                        .filter((task) => isWorkTaskOverdue(task))
                        .slice(0, 5)
                        .map((task) => (
                          <button
                            key={task.id}
                            type='button'
                            className='text-left text-13px text-t-primary hover:underline'
                            onClick={() => navigate(`/tasks/${task.id}`)}
                          >
                            {task.title}
                            {task.assignee?.username ? ` · ${task.assignee.username}` : ''}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              ) : null}
            </CollapseItem>
          </Collapse>
        )}

        <Tabs
          activeTab={scopeTab}
          onChange={(key) => setScopeTab(key as WorkTaskScope)}
          type='rounded'
        >
          {scopeTabs.map((item) => (
            <Tabs.TabPane key={item.key} title={item.label} />
          ))}
        </Tabs>

        <Select
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as WorkTaskStatus | 'all')}
          style={{ width: 200 }}
          placeholder={t('workTasks.page.statusFilter')}
        >
          <Select.Option value='all'>{t('workTasks.page.allStatuses')}</Select.Option>
          {WORK_TASK_STATUSES.map((status) => (
            <Select.Option key={status} value={status}>
              {t(WORK_TASK_STATUS_I18N_KEY[status])}
            </Select.Option>
          ))}
        </Select>

        {loading ? (
          <div className='flex justify-center py-40px'>
            <Spin />
          </div>
        ) : tasks.length === 0 ? (
          <Empty description={t('workTasks.page.empty')} />
        ) : (
          <div className='flex flex-col gap-10px'>
            {tasks.map((task) => {
              const overdue = isWorkTaskOverdue(task);
              const canAccept = canTransitionWorkTaskStatus(task.status, 'accepted');
              const canComplete = canTransitionWorkTaskStatus(task.status, 'completed');
              return (
                <button
                  key={task.id}
                  type='button'
                  className={classNames(
                    'w-full text-left rd-12px border px-16px py-14px hover:bg-fill-2 transition-colors cursor-pointer',
                    overdue ? 'border-red-300 bg-red-50/30' : 'border-[var(--color-border-2)] bg-fill-1'
                  )}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                >
                  <div className='flex items-center justify-between gap-8px'>
                    <span className='font-500 text-t-primary truncate'>{task.title}</span>
                    <div className='flex items-center gap-6px shrink-0'>
                      <WorkTaskSourceTag task={task} />
                      {task.attachments.length > 0 && (
                        <Tag size='small'>{task.attachments.length}</Tag>
                      )}
                      <WorkTaskStatusTag status={task.status} />
                    </div>
                  </div>
                  <div className='mt-6px flex flex-wrap gap-x-12px gap-y-4px text-12px text-t-secondary'>
                    {task.assignee?.username && (
                      <span>{t('workTasks.card.assignee', { name: task.assignee.username })}</span>
                    )}
                    {task.created_by?.username && task.created_by.id !== task.assignee?.id && (
                      <span>{t('workTasks.card.creator', { name: task.created_by.username })}</span>
                    )}
                    {task.due_at && (
                      <span className={overdue ? 'text-red-500' : undefined}>
                        {overdue ? t('workTasks.card.overdue') : t('workTasks.card.dueAt')}: {formatDue(task.due_at)}
                      </span>
                    )}
                  </div>
                  {task.description ? (
                    <p className='mt-6px mb-0 text-13px text-t-secondary line-clamp-2'>{task.description}</p>
                  ) : null}
                  {(canAccept || canComplete) && (
                    <div className='mt-10px flex gap-8px' onClick={(e) => e.stopPropagation()}>
                      {canAccept && task.status === 'pending_accept' && (
                        <Button size='mini' type='primary' onClick={(e) => void handleQuickAccept(task, e)}>
                          {t('workTasks.action.accept')}
                        </Button>
                      )}
                      {canComplete && task.status === 'accepted' && (
                        <Button size='mini' onClick={(e) => void handleQuickComplete(task, e)}>
                          {t('workTasks.action.complete')}
                        </Button>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <CreateWorkTaskDialog
        visible={dialogVisible}
        onClose={() => setDialogVisible(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
};

export default WorkTasksPage;
