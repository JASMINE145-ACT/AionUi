/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type {
  WorkTask,
  WorkTaskMember,
  WorkTaskQueryParams,
  WorkTaskQueryResponse,
  WorkTaskScope,
  WorkTaskStatus,
} from '@/common/types/workTasks/workTaskTypes';
import { isWorkTaskManager } from '@/common/types/workTasks/workTaskTypes';
import { isBackendHttpError } from '@/common/adapter/httpBridge';
import { isOrgServerConfigured } from '@/common/adapter/orgHttpBridge';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

/** SWR poll interval for org work tasks (decision D8: 30–60s). */
export const WORK_TASKS_POLL_MS = 45_000;

export type UseWorkTasksOptions = {
  statusFilter?: WorkTaskStatus;
  scope?: WorkTaskScope;
};

function isOrgWorkTasksUnavailableError(error: unknown): boolean {
  if (!isOrgServerConfigured()) {
    return true;
  }
  if (isBackendHttpError(error)) {
    return [401, 403, 404, 501, 503].includes(error.status);
  }
  if (error instanceof TypeError) {
    return true;
  }
  return false;
}

export function useWorkTasks(options: UseWorkTasksOptions = {}) {
  const { statusFilter, scope = 'visible' } = options;
  const { user } = useAuth();
  const ownerKey = user?.id ?? 'system_default_user';
  const swrKey = isOrgServerConfigured()
    ? `work-tasks/org/${ownerKey}/${scope}/${statusFilter ?? 'all'}`
    : null;

  const [apiUnavailable, setApiUnavailable] = useState(!isOrgServerConfigured());

  const fetchTasks = useCallback(async () => {
    if (!isOrgServerConfigured()) {
      setApiUnavailable(true);
      return [];
    }
    try {
      const tasks = await ipcBridge.workTask.listTasks.invoke({
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(scope !== 'visible' ? { scope } : {}),
      });
      setApiUnavailable(false);
      return tasks;
    } catch (error) {
      if (isOrgWorkTasksUnavailableError(error)) {
        setApiUnavailable(true);
        return [];
      }
      throw error;
    }
  }, [scope, statusFilter]);

  const { data: tasks = [], isLoading, mutate, error } = useSWR<WorkTask[]>(swrKey, fetchTasks, {
    revalidateOnFocus: true,
    refreshInterval: WORK_TASKS_POLL_MS,
  });

  const createTask = useCallback(
    async (params: Parameters<typeof ipcBridge.workTask.createTask.invoke>[0]) => {
      const created = await ipcBridge.workTask.createTask.invoke(params);
      await mutate();
      return created;
    },
    [mutate]
  );

  const updateTask = useCallback(
    async (task_id: string, updates: Parameters<typeof ipcBridge.workTask.updateTask.invoke>[0]['updates']) => {
      const updated = await ipcBridge.workTask.updateTask.invoke({ task_id, updates });
      await mutate();
      return updated;
    },
    [mutate]
  );

  const deleteTask = useCallback(
    async (task_id: string) => {
      await ipcBridge.workTask.deleteTask.invoke({ task_id });
      await mutate();
    },
    [mutate]
  );

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => b.updated_at - a.updated_at),
    [tasks]
  );

  return {
    tasks: sortedTasks,
    loading: isLoading,
    error,
    apiUnavailable,
    mutate,
    createTask,
    updateTask,
    deleteTask,
  };
}

export function useWorkTaskMembers() {
  const swrKey = isOrgServerConfigured() ? 'work-task-members/org' : null;

  const { data, isLoading, error } = useSWR<WorkTaskMember[]>(
    swrKey,
    () => ipcBridge.workTask.listMembers.invoke(),
    { revalidateOnFocus: true, refreshInterval: WORK_TASKS_POLL_MS }
  );

  const employees = useMemo(
    () => (data ?? []).filter((member) => member.work_task_role === 'employee'),
    [data]
  );

  return { members: data ?? [], employees, loading: isLoading, error };
}

export function useWorkTaskQuery(enabled: boolean, params?: WorkTaskQueryParams) {
  const paramKey = params
    ? `${params.assignee_id ?? ''}|${params.status ?? ''}`
    : 'overview';
  const swrKey = enabled && isOrgServerConfigured() ? `work-tasks/query/org/${paramKey}` : null;

  const { data, isLoading, mutate, error } = useSWR<WorkTaskQueryResponse | null>(
    swrKey,
    () => ipcBridge.workTask.queryTasks.invoke(params ?? {}),
    { revalidateOnFocus: true, refreshInterval: WORK_TASKS_POLL_MS }
  );

  return { query: data ?? undefined, loading: isLoading, error, mutate };
}

export function usePendingAcceptCount() {
  const { user } = useAuth();
  const ownerKey = user?.id ?? 'system_default_user';
  const swrKey = isOrgServerConfigured() ? `work-tasks/pending-count/org/${ownerKey}` : null;

  const { data = 0, mutate } = useSWR(
    swrKey,
    async () => {
      try {
        const tasks = await ipcBridge.workTask.listTasks.invoke({
          scope: 'mine',
          status: 'pending_accept',
        });
        return tasks.length;
      } catch {
        return 0;
      }
    },
    { refreshInterval: 60_000, revalidateOnFocus: true }
  );

  return data;
}

export function useWorkTaskRole() {
  const { user } = useAuth();
  const role = user?.work_task_role ?? 'employee';
  return {
    role,
    isManager: isWorkTaskManager(role),
  };
}

export function useWorkTask(taskId: string | undefined) {
  const swrKey = taskId && isOrgServerConfigured() ? `work-task/org/${taskId}` : null;

  const { data, isLoading, mutate, error } = useSWR<WorkTask | null>(
    swrKey,
    () => (taskId ? ipcBridge.workTask.getTask.invoke({ task_id: taskId }) : null),
    { revalidateOnFocus: true, refreshInterval: WORK_TASKS_POLL_MS }
  );

  return { task: data ?? undefined, loading: isLoading, error, mutate };
}
