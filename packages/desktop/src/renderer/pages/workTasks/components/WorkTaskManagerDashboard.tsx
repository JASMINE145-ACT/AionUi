/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Alert, Empty, Tag } from '@arco-design/web-react';
import {
  CheckOne,
  Right,
  Time,
  User,
  Peoples,
  ListCheckbox,
  Caution,
} from '@icon-park/react';
import type { WorkTask, WorkTaskStatus } from '@/common/types/workTasks/workTaskTypes';
import type { WorkTaskQuerySummary } from '@/common/types/workTasks/workTaskTypes';
import { WORK_TASKS_ASSIGNEE_UNASSIGNED } from '@/common/types/workTasks/workTaskFilterState';
import {
  WORK_TASK_DASHBOARD_ITEMS_CAP,
  type WorkTaskAssigneeGroup,
  getAssigneeWorkloadSegments,
  getMaxAssigneeGroupTotal,
} from '@/common/types/workTasks/workTaskDashboard';

type WorkTaskManagerDashboardProps = {
  summary: WorkTaskQuerySummary;
  groups: WorkTaskAssigneeGroup[];
  overdue: WorkTask[];
  truncated: boolean;
  totalBeforeCap: number;
  loading: boolean;
  isMobile: boolean;
  compact?: boolean;
  selectedAssignee: string | null;
  selectedStatus: WorkTaskStatus | null;
  selectedOverdue: boolean;
  onTaskClick: (taskId: string) => void;
  onAssigneeClick: (assigneeId: string | null) => void;
  onStatClick: (stat: 'total' | 'pending_accept' | 'accepted' | 'completed' | 'overdue') => void;
};

const SEGMENT_CLASS: Record<'pending' | 'accepted' | 'other', string> = {
  pending: 'bg-[rgb(var(--orange-6))]',
  accepted: 'bg-[rgb(var(--arcoblue-6))]',
  other: 'bg-[var(--color-fill-3)]',
};

function assigneeInitial(username: string): string {
  const trimmed = username.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

type StatCardProps = {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: 'default' | 'warning' | 'danger' | 'success';
  isMobile: boolean;
  compact?: boolean;
  selected?: boolean;
  onClick?: () => void;
};

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  accent = 'default',
  isMobile,
  compact,
  selected,
  onClick,
}) => {
  const accentStyles = {
    default: {
      bg: 'linear-gradient(135deg, rgba(15,23,42,0.06) 0%, rgba(51,65,85,0.04) 100%)',
      color: 'rgb(var(--primary-6))',
      valueClass: 'text-t-primary',
    },
    warning: {
      bg: 'linear-gradient(135deg, rgba(var(--orange-6),0.14) 0%, rgba(var(--orange-6),0.06) 100%)',
      color: 'rgb(var(--orange-6))',
      valueClass: 'text-[rgb(var(--orange-6))]',
    },
    danger: {
      bg: 'linear-gradient(135deg, rgba(var(--red-6),0.14) 0%, rgba(var(--red-6),0.06) 100%)',
      color: 'rgb(var(--red-6))',
      valueClass: 'text-[rgb(var(--red-6))]',
    },
    success: {
      bg: 'linear-gradient(135deg, rgba(var(--green-6),0.14) 0%, rgba(var(--green-6),0.06) 100%)',
      color: 'rgb(var(--green-6))',
      valueClass: 'text-[rgb(var(--green-6))]',
    },
  }[accent];

  const content = (
    <>
      <div className='flex items-center justify-between gap-6px'>
        <span className={classNames('leading-16px text-t-secondary font-500', compact ? 'text-11px' : 'text-12px')}>
          {label}
        </span>
        <div
          className={classNames(
            'shrink-0 rd-6px flex items-center justify-center',
            compact ? 'size-22px' : 'size-28px'
          )}
          style={{ background: accentStyles.bg, color: accentStyles.color }}
          aria-hidden
        >
          {icon}
        </div>
      </div>
      <span
        className={classNames(
          'font-700 tabular-nums tracking-tight',
          compact ? 'text-20px leading-24px' : 'text-26px leading-32px',
          accentStyles.valueClass
        )}
      >
        {value}
      </span>
    </>
  );

  const shellClass = classNames(
    'flex flex-col border bg-[var(--color-bg-1)] text-left',
    'transition-all duration-200',
    compact ? 'gap-4px rd-8px p-8px' : 'gap-6px rd-10px',
    !compact && (isMobile ? 'p-10px' : 'p-12px'),
    selected
      ? 'border-[rgb(var(--primary-6))] shadow-[0_0_0_1px_rgba(var(--primary-6),0.35)]'
      : 'border-[var(--color-border-2)] hover:border-[rgba(var(--primary-6),0.35)]',
    onClick &&
      'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--primary-6))]'
  );

  if (onClick) {
    return (
      <button type='button' className={shellClass} onClick={onClick} aria-pressed={selected}>
        {content}
      </button>
    );
  }

  return <div className={shellClass}>{content}</div>;
};

const DashboardSkeleton: React.FC<{ isMobile: boolean }> = ({ isMobile }) => (
  <div className='animate-pulse flex flex-col gap-12px' aria-busy aria-label='Loading'>
    <div
      className={classNames(
        'grid gap-10px',
        isMobile ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
      )}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className='h-72px rd-12px bg-fill-2' />
      ))}
    </div>
    <div className={classNames('grid gap-12px', isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3')}>
      <div className={classNames('h-220px rd-12px bg-fill-2', isMobile ? '' : 'lg:col-span-2')} />
      <div className='h-220px rd-12px bg-fill-2' />
    </div>
  </div>
);

const WorkTaskManagerDashboard: React.FC<WorkTaskManagerDashboardProps> = ({
  summary,
  groups,
  overdue,
  truncated,
  totalBeforeCap,
  loading,
  isMobile,
  compact = false,
  selectedAssignee,
  selectedStatus,
  selectedOverdue,
  onTaskClick,
  onAssigneeClick,
  onStatClick,
}) => {
  const { t } = useTranslation();
  const maxGroupTotal = useMemo(() => getMaxAssigneeGroupTotal(groups), [groups]);

  const formatDue = (dueAt?: number | null) => {
    if (!dueAt) return null;
    return new Date(dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <section
        className='rd-10px border border-[var(--color-border-2)] bg-[var(--color-bg-2)] p-12px'
        aria-label={t('workTasks.overview.title')}
      >
        <DashboardSkeleton isMobile={isMobile} />
      </section>
    );
  }

  return (
    <section
      className={classNames(
        'rd-10px border border-[var(--color-border-2)] bg-[var(--color-bg-2)] overflow-hidden',
        'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.04)]'
      )}
      aria-label={t('workTasks.overview.title')}
    >
      <header
        className={classNames(
          'border-b border-[var(--color-border-2)] flex items-center gap-10px',
          compact ? 'px-12px py-8px' : 'px-14px py-12px'
        )}
      >
        <div
          className={classNames(
            'shrink-0 rd-8px flex items-center justify-center',
            compact ? 'size-28px' : 'size-32px'
          )}
          style={{
            background: 'linear-gradient(135deg, rgba(3,105,161,0.12) 0%, rgba(15,23,42,0.06) 100%)',
            color: 'rgb(var(--primary-6))',
          }}
          aria-hidden
        >
          <Peoples theme='outline' size={compact ? 16 : 18} fill='currentColor' />
        </div>
        <div className='min-w-0 flex-1'>
          <h2 className={classNames('m-0 font-600 text-t-primary', compact ? 'text-14px' : 'text-15px')}>
            {t('workTasks.overview.title')}
          </h2>
          {!compact && (
            <p className='m-0 mt-2px text-12px text-t-secondary'>{t('workTasks.overview.subtitle')}</p>
          )}
        </div>
      </header>

      <div className={classNames('flex flex-col', compact ? 'px-12px py-10px gap-10px' : 'px-14px py-12px gap-12px')}>
        {truncated && (
          <Alert
            type='info'
            showIcon
            content={
              <span>
                {t('workTasks.overview.truncated', {
                  cap: WORK_TASK_DASHBOARD_ITEMS_CAP,
                  total: totalBeforeCap,
                })}{' '}
                {t('workTasks.overview.truncatedWorkloadHint', { cap: WORK_TASK_DASHBOARD_ITEMS_CAP })}
              </span>
            }
          />
        )}

        <div
          className={classNames(
            'grid',
            compact ? 'gap-6px' : 'gap-8px',
            isMobile ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
          )}
        >
          <StatCard
            label={t('workTasks.overview.statTotal')}
            value={summary.total}
            icon={<ListCheckbox theme='outline' size={compact ? 14 : 16} fill='currentColor' />}
            isMobile={isMobile}
            compact={compact}
            selected={!selectedStatus && !selectedOverdue}
            onClick={() => onStatClick('total')}
          />
          <StatCard
            label={t('workTasks.overview.statPending')}
            value={summary.pending_accept}
            accent={summary.pending_accept > 0 ? 'warning' : 'default'}
            icon={<Time theme='outline' size={compact ? 14 : 16} fill='currentColor' />}
            isMobile={isMobile}
            compact={compact}
            selected={selectedStatus === 'pending_accept'}
            onClick={() => onStatClick('pending_accept')}
          />
          <StatCard
            label={t('workTasks.overview.statInProgress')}
            value={summary.accepted}
            icon={<User theme='outline' size={compact ? 14 : 16} fill='currentColor' />}
            isMobile={isMobile}
            compact={compact}
            selected={selectedStatus === 'accepted'}
            onClick={() => onStatClick('accepted')}
          />
          <StatCard
            label={t('workTasks.overview.statCompleted')}
            value={summary.completed}
            accent={summary.completed > 0 ? 'success' : 'default'}
            icon={<CheckOne theme='outline' size={compact ? 14 : 16} fill='currentColor' />}
            isMobile={isMobile}
            compact={compact}
            selected={selectedStatus === 'completed'}
            onClick={() => onStatClick('completed')}
          />
          <StatCard
            label={t('workTasks.overview.statOverdue')}
            value={summary.overdue_count}
            accent={summary.overdue_count > 0 ? 'danger' : 'default'}
            icon={<Caution theme='outline' size={compact ? 14 : 16} fill='currentColor' />}
            isMobile={isMobile}
            compact={compact}
            selected={selectedOverdue}
            onClick={() => onStatClick('overdue')}
          />
        </div>

        <div
          className={classNames(
            'grid gap-12px',
            isMobile || overdue.length === 0 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'
          )}
        >
          <div
            className={classNames(
              'flex flex-col rd-10px border border-[var(--color-border-2)] bg-[var(--color-bg-1)] overflow-hidden',
              !isMobile && overdue.length > 0 ? 'lg:col-span-2' : ''
            )}
          >
            <div
              className={classNames(
                'border-b border-[var(--color-border-2)] flex items-center justify-between gap-8px',
                compact ? 'px-10px py-8px' : 'px-12px py-10px'
              )}
            >
              <span className={classNames('font-600 text-t-primary', compact ? 'text-12px' : 'text-13px')}>
                {t('workTasks.overview.workloadTitle')}
              </span>
              <div className='flex flex-wrap items-center gap-6px text-11px text-t-secondary'>
                <span className='inline-flex items-center gap-4px'>
                  <span className='size-8px rd-2px bg-[rgb(var(--orange-6))]' aria-hidden />
                  {t('workTasks.overview.legendPending')}
                </span>
                <span className='inline-flex items-center gap-4px'>
                  <span className='size-8px rd-2px bg-[rgb(var(--arcoblue-6))]' aria-hidden />
                  {t('workTasks.overview.legendInProgress')}
                </span>
                <span className='inline-flex items-center gap-4px'>
                  <span className='size-8px rd-2px bg-[var(--color-fill-3)]' aria-hidden />
                  {t('workTasks.overview.legendOther')}
                </span>
              </div>
            </div>

            <div
              className={classNames(
                'flex flex-col',
                compact ? 'p-8px gap-6px min-h-0' : 'p-12px gap-8px min-h-120px'
              )}
            >
              {groups.length === 0 ? (
                <Empty description={t('workTasks.overview.emptyGroups')} />
              ) : (
                groups.map((group) => {
                  const barWidthPct = Math.round((group.total / maxGroupTotal) * 100);
                  const segments = getAssigneeWorkloadSegments(group);
                  const assigneeKey = group.assignee_id ?? WORK_TASKS_ASSIGNEE_UNASSIGNED;
                  const selected =
                    selectedAssignee === assigneeKey ||
                    (selectedAssignee === WORK_TASKS_ASSIGNEE_UNASSIGNED && group.assignee_id == null);
                  return (
                    <button
                      key={group.assignee_id ?? '__unassigned__'}
                      type='button'
                      className={classNames(
                        'w-full flex items-center text-left',
                        'hover:bg-fill-2 transition-colors duration-150 cursor-pointer',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--primary-6))]',
                        compact ? 'gap-8px rd-8px px-8px py-6px' : 'gap-10px rd-8px px-10px py-8px',
                        selected && 'bg-[rgba(var(--primary-6),0.08)] ring-1 ring-[rgba(var(--primary-6),0.3)]'
                      )}
                      onClick={() => onAssigneeClick(group.assignee_id)}
                      aria-pressed={selected}
                    >
                      <div
                        className={classNames(
                          'shrink-0 rd-full flex items-center justify-center font-600 text-[rgb(var(--primary-6))] bg-[rgba(var(--primary-6),0.1)]',
                          compact ? 'size-28px text-12px' : 'size-32px text-13px'
                        )}
                        aria-hidden
                      >
                        {assigneeInitial(group.username)}
                      </div>
                      <div className={classNames('flex-1 min-w-0 flex flex-col', compact ? 'gap-4px' : 'gap-6px')}>
                        <div className='flex items-center justify-between gap-8px min-w-0'>
                          <span className='text-13px font-500 text-t-primary truncate'>{group.username}</span>
                          <span className='text-12px text-t-secondary tabular-nums shrink-0'>
                            {t('workTasks.overview.groupTotal', { count: group.total })}
                          </span>
                        </div>
                        <div
                          className={classNames(
                            'rd-full bg-fill-2 overflow-hidden flex w-full',
                            compact ? 'h-8px' : 'h-10px'
                          )}
                          style={{ width: `${Math.max(barWidthPct, 8)}%`, maxWidth: '100%' }}
                          role='img'
                          aria-label={t('workTasks.overview.workloadAria', {
                            name: group.username,
                            total: group.total,
                          })}
                        >
                          {segments.map((seg) => (
                            <div
                              key={seg.key}
                              className={classNames('h-full transition-all duration-200', SEGMENT_CLASS[seg.key])}
                              style={{ width: `${(seg.count / group.total) * 100}%` }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className='flex flex-col items-end gap-4px shrink-0'>
                        {group.pending_accept > 0 && (
                          <Tag size='small' color='orangered'>
                            {t('workTasks.overview.groupPending', { count: group.pending_accept })}
                          </Tag>
                        )}
                        {group.overdue_count > 0 && (
                          <Tag size='small' color='red'>
                            {t('workTasks.overview.groupOverdue', { count: group.overdue_count })}
                          </Tag>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {overdue.length === 0 ? (
            !compact && (
              <div className='flex items-center gap-8px px-4px py-2px text-12px text-t-secondary'>
                <Caution theme='outline' size={14} fill='currentColor' />
                <span>{t('workTasks.overview.noOverdue')}</span>
              </div>
            )
          ) : (
          <div
            className={classNames(
              'flex flex-col rd-10px border overflow-hidden',
              'border-[rgba(var(--red-6),0.35)] bg-[rgba(var(--red-6),0.03)]'
            )}
          >
            <div
              className={classNames(
                'px-12px py-10px border-b flex items-center gap-8px',
                overdue.length > 0 ? 'border-[rgba(var(--red-6),0.2)]' : 'border-[var(--color-border-2)]'
              )}
            >
              <Caution
                theme='outline'
                size={16}
                fill={overdue.length > 0 ? 'rgb(var(--red-6))' : 'currentColor'}
                className={overdue.length > 0 ? 'text-[rgb(var(--red-6))]' : 'text-t-secondary'}
              />
              <span className='text-13px font-600 text-t-primary'>{t('workTasks.overview.overdueList')}</span>
              {overdue.length > 0 && (
                <Tag size='small' color='red'>
                  {t('workTasks.overview.needsAttention', { count: overdue.length })}
                </Tag>
              )}
            </div>

            <div className='p-8px flex flex-col gap-4px flex-1 min-h-100px'>
              {overdue.map((task) => (
                  <button
                    key={task.id}
                    type='button'
                    className={classNames(
                      'w-full text-left flex items-center gap-8px rd-8px px-10px py-8px',
                      'border border-transparent hover:border-[rgba(var(--red-6),0.25)]',
                      'hover:bg-[rgba(var(--red-6),0.06)] transition-colors duration-150 cursor-pointer group',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--primary-6))]'
                    )}
                    onClick={() => onTaskClick(task.id)}
                  >
                    <div className='flex-1 min-w-0'>
                      <p className='m-0 text-13px font-500 text-t-primary truncate'>{task.title}</p>
                      <p className='m-0 mt-2px text-11px text-t-secondary truncate'>
                        {task.assignee?.username
                          ? t('workTasks.card.assignee', { name: task.assignee.username })
                          : t('workTasks.overview.unassigned')}
                        {task.due_at ? ` · ${formatDue(task.due_at)}` : ''}
                      </p>
                    </div>
                    <Right
                      theme='outline'
                      size={14}
                      fill='currentColor'
                      className='shrink-0 text-t-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-150'
                    />
                  </button>
                ))}
            </div>
          </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default WorkTaskManagerDashboard;
