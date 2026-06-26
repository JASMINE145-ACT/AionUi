/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type {
  WorkTask,
  WorkTaskMember,
  WorkTaskQueryResponse,
  WorkTaskScope,
  WorkTaskStatus,
} from '@/common/types/workTasks/workTaskTypes';
import { isWorkTaskManager } from '@/common/types/workTasks/workTaskTypes';
import { isBackendHttpError } from '@/common/adapter/httpBridge';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

export type UseWorkTasksOptions = {
  statusFilter?: WorkTaskStatus;
  scope?: WorkTaskScope;
};

export function useWorkTasks(options: UseWorkTasksOptions = {}) {
  const { statusFilter, scope = 'visible' } = options;
  const { user } = useAuth();
  const ownerKey = user?.id ?? 'system_default_user';
  const swrKey = `work-tasks/${ownerKey}/${scope}/${statusFilter ?? 'all'}`;

  const [apiUnavailable, setApiUnavailable] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const tasks = await ipcBridge.workTask.listTasks.invoke({
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(scope !== 'visible' ? { scope } : {}),
      });
      setApiUnavailable(false);
      return tasks;
    } catch (error) {
      if (isBackendHttpError(error) && (error.status === 404 || error.status === 501)) {
        setApiUnavailable(true);
        return [];
      }
      throw error;
    }
  }, [scope, statusFilter]);

  const { data: tasks = [], isLoading, mutate, error } = useSWR<WorkTask[]>(swrKey, fetchTasks, {
    revalidateOnFocus: true,
  });

  useEffect(() => {
    const refresh = (): void => void mutate();
    const unsubCreated = ipcBridge.workTask.onTaskCreated.on(refresh);
    const unsubUpdated = ipcBridge.workTask.onTaskUpdated.on(refresh);
    const unsubDeleted = ipcBridge.workTask.onTaskDeleted.on(refresh);
    return () => {
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
    };
  }, [mutate]);

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
  const { data, isLoading, error } = useSWR<WorkTaskMember[]>(
    'work-task-members',
    () => ipcBridge.workTask.listMembers.invoke(),
    { revalidateOnFocus: false }
  );

  const employees = useMemo(
    () => (data ?? []).filter((member) => member.work_task_role === 'employee'),
    [data]
  );

  return { members: data ?? [], employees, loading: isLoading, error };
}

export function useWorkTaskQuery(enabled: boolean) {
  const { data, isLoading, mutate, error } = useSWR<WorkTaskQueryResponse | null>(
    enabled ? 'work-tasks/query' : null,
    () => ipcBridge.workTask.queryTasks.invoke({}),
    { revalidateOnFocus: true }
  );

  useEffect(() => {
    if (!enabled) return;
    const refresh = (): void => void mutate();
    const unsubUpdated = ipcBridge.workTask.onTaskUpdated.on(refresh);
    const unsubCreated = ipcBridge.workTask.onTaskCreated.on(refresh);
    const unsubDeleted = ipcBridge.workTask.onTaskDeleted.on(refresh);
    return () => {
      unsubUpdated();
      unsubCreated();
      unsubDeleted();
    };
  }, [enabled, mutate]);

  return { query: data ?? undefined, loading: isLoading, error, mutate };
}

export function usePendingAcceptCount() {
  const { user } = useAuth();
  const ownerKey = user?.id ?? 'system_default_user';

  const { data = 0, mutate } = useSWR(
    `work-tasks/pending-count/${ownerKey}`,
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

  useEffect(() => {
    const refresh = (): void => void mutate();
    const unsub = ipcBridge.workTask.onTaskUpdated.on(refresh);
    const unsub2 = ipcBridge.workTask.onTaskCreated.on(refresh);
    return () => {
      unsub();
      unsub2();
    };
  }, [mutate]);

  return data;
}

export function useWorkTaskRole() {
  const { user } = useAuth();
  return {
    role: user?.work_task_role ?? 'manager',
    isManager: isWorkTaskManager(user?.work_task_role ?? 'manager'),
  };
}

export function useWorkTask(taskId: string | undefined) {
  const { data, isLoading, mutate, error } = useSWR<WorkTask | null>(
    taskId ? `work-task/${taskId}` : null,
    () => (taskId ? ipcBridge.workTask.getTask.invoke({ task_id: taskId }) : null),
    { revalidateOnFocus: true }
  );

  useEffect(() => {
    if (!taskId) return;
    const refresh = (): void => void mutate();
    const unsubUpdated = ipcBridge.workTask.onTaskUpdated.on((task) => {
      if (task.id === taskId) refresh();
    });
    const unsubDeleted = ipcBridge.workTask.onTaskDeleted.on((payload) => {
      if (payload.task_id === taskId) refresh();
    });
    return () => {
      unsubUpdated();
      unsubDeleted();
    };
  }, [mutate, taskId]);

  return { task: data ?? undefined, loading: isLoading, error, mutate };
}
