/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import classNames from 'classnames';
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Empty, Message, Select, Spin, Tabs, Alert, Tag } from '@arco-design/web-react';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import type { WorkTask, WorkTaskScope, WorkTaskStatus } from '@/common/types/workTasks/workTaskTypes';
import {
  WORK_TASK_SCOPE_I18N_KEY,
  WORK_TASK_STATUS_I18N_KEY,
  WORK_TASK_STATUSES,
  canAcceptWorkTask,
  canCompleteWorkTask,
  isWorkTaskOverdue,
} from '@/common/types/workTasks/workTaskTypes';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import {
  WORK_TASK_DASHBOARD_OVERDUE_LIMIT,
  capWorkTasksForDashboard,
  groupWorkTasksByAssignee,
  listOverdueWorkTasks,
} from '@/common/types/workTasks/workTaskDashboard';
import {
  WORK_TASKS_ASSIGNEE_UNASSIGNED,
  applyOverdueClientFilter,
  clearStatusAndOverdue,
  emptyWorkTasksFilterState,
  filterOverviewClientWorkTasks,
  filterUnassignedWorkTasks,
  hasWorkTasksFilterParams,
  isWorkTasksFilterActive,
  parseWorkTasksSearchParams,
  resolveWorkTasksListMode,
  serializeWorkTasksFilterState,
  stripWorkTasksFilterParams,
  toWorkTaskQueryParams,
  withAssigneeFilter,
  withOverdueFilter,
  withStatusFilter,
  type WorkTasksFilterState,
} from '@/common/types/workTasks/workTaskFilterState';
import {
  useWorkTaskQuery,
  useWorkTaskRole,
  useWorkTasks,
} from '@renderer/pages/workTasks/useWorkTasks';
import WorkTaskStatusTag from '@renderer/pages/workTasks/components/WorkTaskStatusTag';
import WorkTaskSourceTag from '@renderer/pages/workTasks/components/WorkTaskSourceTag';
import CreateWorkTaskDialog from '@renderer/pages/workTasks/components/CreateWorkTaskDialog';
import WorkTaskManagerDashboard from '@renderer/pages/workTasks/components/WorkTaskManagerDashboard';

const WorkTasksPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isManager } = useWorkTaskRole();
  const { user } = useAuth();
  const currentUserId = user?.id;
  const [scopeTab, setScopeTab] = useState<WorkTaskScope>('visible');
  const [dialogVisible, setDialogVisible] = useState(false);
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<WorkTaskStatus | 'all'>('all');

  const { state: filterState, didNormalize } = useMemo(
    () => parseWorkTasksSearchParams(searchParams),
    [searchParams]
  );
  const filterActive = isWorkTasksFilterActive(filterState);
  const listMode = useMemo(() => resolveWorkTasksListMode(filterState), [filterState]);
  const queryParams = useMemo(() => toWorkTaskQueryParams(filterState), [filterState]);

  useLayoutEffect(() => {
    if (!isManager) {
      if (hasWorkTasksFilterParams(searchParams)) {
        const stripped = stripWorkTasksFilterParams(searchParams);
        setSearchParams(stripped, { replace: true });
      }
      return;
    }
    if (didNormalize) {
      setSearchParams(serializeWorkTasksFilterState(filterState), { replace: true });
    }
  }, [isManager, searchParams, setSearchParams, didNormalize, filterState]);

  const listSectionRef = React.useRef<HTMLDivElement>(null);

  const pushFilter = useCallback(
    (next: WorkTasksFilterState, opts?: { scrollToList?: boolean }) => {
      setSearchParams(serializeWorkTasksFilterState(next), { replace: false });
      if (opts?.scrollToList) {
        requestAnimationFrame(() => {
          listSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    },
    [setSearchParams]
  );

  const { tasks: listTasks, loading: listLoading, apiUnavailable, createTask, updateTask } = useWorkTasks({
    scope: scopeTab,
    statusFilter:
      !isManager && employeeStatusFilter !== 'all'
        ? employeeStatusFilter
        : !filterActive && filterState.status
          ? filterState.status
          : undefined,
  });

  const { query: overviewQuery, loading: overviewLoading } = useWorkTaskQuery(isManager);
  const {
    query: filteredQuery,
    loading: filteredLoading,
    error: filteredError,
  } = useWorkTaskQuery(isManager && listMode.kind === 'query', queryParams ?? undefined);

  const dashboard = useMemo(() => {
    if (!isManager || !overviewQuery?.items) return null;
    const slice = capWorkTasksForDashboard(overviewQuery.items);
    const unassignedLabel = t('workTasks.overview.unassigned');
    return {
      ...slice,
      groups: groupWorkTasksByAssignee(slice.items, unassignedLabel),
      overdue: listOverdueWorkTasks(slice.items, WORK_TASK_DASHBOARD_OVERDUE_LIMIT),
    };
  }, [isManager, overviewQuery, t]);

  const displayTasks = useMemo(() => {
    if (!isManager || listMode.kind === 'list') return listTasks;
    if (listMode.kind === 'query') {
      const items = applyOverdueClientFilter(filteredQuery?.items ?? [], listMode.overdueClient);
      return [...items].sort((a, b) => b.updated_at - a.updated_at);
    }
    if (listMode.kind === 'overview_client') {
      return filterOverviewClientWorkTasks(overviewQuery?.items ?? [], {
        status: listMode.status,
        overdue: listMode.overdue,
      }).sort((a, b) => b.updated_at - a.updated_at);
    }
    const source = overviewQuery?.items ?? [];
    return filterUnassignedWorkTasks(source, {
      status: listMode.status,
      overdue: listMode.overdue,
    }).sort((a, b) => b.updated_at - a.updated_at);
  }, [isManager, listMode, listTasks, filteredQuery, overviewQuery]);

  const listBusy =
    listMode.kind === 'list'
      ? listLoading
      : listMode.kind === 'query'
        ? filteredLoading
        : overviewLoading;

  const filteredCount = displayTasks.length;

  const assigneeLabel = useMemo(() => {
    if (!filterState.assignee) return null;
    if (filterState.assignee === WORK_TASKS_ASSIGNEE_UNASSIGNED) {
      return t('workTasks.overview.unassigned');
    }
    const group = dashboard?.groups.find((g) => g.assignee_id === filterState.assignee);
    return group?.username ?? filterState.assignee;
  }, [filterState.assignee, dashboard, t]);

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
      if (!canAcceptWorkTask(task, currentUserId)) return;
      await updateTask(task.id, { status: 'accepted' });
      Message.success(t('workTasks.message.updateSuccess'));
    },
    [currentUserId, t, updateTask]
  );

  const handleQuickComplete = useCallback(
    async (task: WorkTask, event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      if (!canCompleteWorkTask(task, currentUserId, user?.work_task_role)) return;
      await updateTask(task.id, { status: 'completed' });
      Message.success(t('workTasks.message.updateSuccess'));
    },
    [currentUserId, t, updateTask, user?.work_task_role]
  );

  const formatDue = (dueAt?: number) => {
    if (!dueAt) return null;
    return new Date(dueAt).toLocaleString();
  };

  const handleAssigneeClick = useCallback(
    (assigneeId: string | null) => {
      const key = assigneeId ?? WORK_TASKS_ASSIGNEE_UNASSIGNED;
      if (filterState.assignee === key) {
        pushFilter(withAssigneeFilter(filterState, null));
        return;
      }
      pushFilter(withAssigneeFilter(filterState, key), { scrollToList: true });
    },
    [filterState, pushFilter]
  );

  const handleStatClick = useCallback(
    (stat: 'total' | 'pending_accept' | 'accepted' | 'completed' | 'overdue') => {
      if (stat === 'total') {
        pushFilter(clearStatusAndOverdue(filterState));
        return;
      }
      if (stat === 'overdue') {
        pushFilter({
          ...filterState,
          status: null,
          overdue: !filterState.overdue,
        });
        return;
      }
      const nextStatus = filterState.status === stat ? null : stat;
      pushFilter(withStatusFilter({ ...filterState, overdue: false }, nextStatus));
    },
    [filterState, pushFilter]
  );

  const handleStatusSelect = useCallback(
    (value: WorkTaskStatus | 'all') => {
      if (!isManager) {
        setEmployeeStatusFilter(value);
        return;
      }
      pushFilter(withStatusFilter(filterState, value === 'all' ? null : value));
    },
    [filterState, pushFilter, isManager]
  );

  return (
    <div
      className={classNames(
        'w-full min-h-full box-border overflow-y-auto',
        isMobile
          ? 'px-16px py-14px'
          : filterActive
            ? 'px-12px py-16px md:px-40px md:py-20px'
            : 'px-12px py-24px md:px-40px md:py-32px'
      )}
    >
      <div
        className={classNames(
          'mx-auto flex w-full flex-col',
          isManager ? 'max-w-960px' : 'max-w-800px',
          filterActive ? 'gap-12px' : isMobile ? 'gap-14px' : 'gap-16px'
        )}
      >
        <div className='flex items-start justify-between gap-12px'>
          <div>
            <h1 className={classNames('m-0 font-bold text-t-primary', isMobile ? 'text-22px' : 'text-24px')}>
              {t('workTasks.page.title')}
            </h1>
            <p className='mt-4px mb-0 text-13px text-t-secondary'>{t('workTasks.page.description')}</p>
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

        {isManager && !apiUnavailable && (overviewLoading || overviewQuery) && (
          <WorkTaskManagerDashboard
            summary={
              overviewQuery?.summary ?? {
                total: 0,
                pending_accept: 0,
                accepted: 0,
                completed: 0,
                incomplete: 0,
                deferred: 0,
                overdue_count: 0,
              }
            }
            groups={dashboard?.groups ?? []}
            overdue={dashboard?.overdue ?? []}
            truncated={dashboard?.truncated ?? false}
            totalBeforeCap={dashboard?.totalBeforeCap ?? 0}
            loading={overviewLoading}
            isMobile={isMobile}
            compact={filterActive}
            selectedAssignee={filterState.assignee}
            selectedStatus={filterState.status}
            selectedOverdue={filterState.overdue}
            onTaskClick={(taskId) => navigate(`/tasks/${taskId}`)}
            onAssigneeClick={handleAssigneeClick}
            onStatClick={handleStatClick}
          />
        )}

        {isManager && !apiUnavailable && !overviewLoading && !overviewQuery && (
          <Alert type='warning' content={t('workTasks.overview.loadFailed')} />
        )}

        {isManager && filterActive && (
          <div
            className={classNames(
              'flex flex-wrap items-center gap-8px rd-10px border border-[var(--color-border-2)]',
              'bg-[var(--color-bg-2)] px-12px py-8px'
            )}
          >
            {filterState.assignee && (
              <Tag
                closable
                color='arcoblue'
                onClose={() => pushFilter(withAssigneeFilter(filterState, null))}
              >
                {t('workTasks.filter.viewingAssignee', { name: assigneeLabel })}
              </Tag>
            )}
            {filterState.status && (
              <Tag
                closable
                color='orangered'
                onClose={() => pushFilter(withStatusFilter(filterState, null))}
              >
                {t(WORK_TASK_STATUS_I18N_KEY[filterState.status])}
              </Tag>
            )}
            {filterState.overdue && (
              <Tag closable color='red' onClose={() => pushFilter(withOverdueFilter(filterState, false))}>
                {t('workTasks.filter.overdueOnly')}
              </Tag>
            )}
            <Button size='mini' type='text' onClick={() => pushFilter(emptyWorkTasksFilterState())}>
              {t('workTasks.filter.clear')}
            </Button>
            <span className='ml-auto text-12px font-500 text-t-secondary tabular-nums'>
              {t('workTasks.filter.resultCount', { count: filteredCount })}
            </span>
          </div>
        )}

        {isManager && listMode.kind === 'unassigned_client' && dashboard?.truncated && (
          <Alert type='warning' content={t('workTasks.filter.unassignedPartial')} />
        )}

        {isManager && listMode.kind === 'query' && filteredError && (
          <Alert
            type='error'
            content={t('workTasks.filter.queryFailed')}
            action={
              <Button size='mini' type='text' onClick={() => pushFilter(emptyWorkTasksFilterState())}>
                {t('workTasks.filter.clear')}
              </Button>
            }
          />
        )}

        <div
          ref={listSectionRef}
          className={classNames('flex flex-col gap-10px', filterActive && 'opacity-95')}
        >
        <Tabs
          activeTab={scopeTab}
          onChange={(key) => {
            if (filterActive) return;
            setScopeTab(key as WorkTaskScope);
          }}
          type='rounded'
          className={filterActive ? 'opacity-50 pointer-events-none' : undefined}
        >
          {scopeTabs.map((item) => (
            <Tabs.TabPane key={item.key} title={item.label} />
          ))}
        </Tabs>

        <Select
          value={isManager ? (filterState.status ?? 'all') : employeeStatusFilter}
          onChange={(value) => handleStatusSelect(value as WorkTaskStatus | 'all')}
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

        {listBusy ? (
          <div className='flex justify-center py-40px'>
            <Spin />
          </div>
        ) : displayTasks.length === 0 ? (
          <Empty
            description={
              filterActive
                ? filterState.assignee
                  ? t('workTasks.filter.empty', { name: assigneeLabel ?? '' })
                  : t('workTasks.filter.emptyGeneric')
                : t('workTasks.page.empty')
            }
          />
        ) : (
          <div className='flex flex-col gap-10px'>
            {displayTasks.map((task) => {
              const overdue = isWorkTaskOverdue(task);
              const canAccept = canAcceptWorkTask(task, currentUserId);
              const canComplete = canCompleteWorkTask(task, currentUserId, user?.work_task_role);
              return (
                <button
                  key={task.id}
                  type='button'
                  className={classNames(
                    'w-full text-left rd-10px border px-14px py-12px hover:bg-fill-2 transition-colors cursor-pointer',
                    overdue ? 'border-red-300 bg-red-50/30' : 'border-[var(--color-border-2)] bg-[var(--color-bg-2)]'
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
