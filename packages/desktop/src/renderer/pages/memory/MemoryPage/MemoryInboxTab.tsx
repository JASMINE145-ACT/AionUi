/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input, Message, Spin, Tag, Typography } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ipcBridge } from '@/common';
import type { PrecipitationLane, PrecipitationProposal } from '@/common/config/ccbPrecipitationTypes';
import useSWR from 'swr';

const { TextArea } = Input;

const LANE_LABEL: Record<PrecipitationLane, string> = {
  business_rule: '业务规则',
  personal_habit: '个人习惯',
  golden_path: '实现路径',
  eval_case: 'Eval',
  unknown: '其他',
};

type MemoryInboxTabProps = {
  highlightId?: string | null;
  conversationId?: string | null;
};

export const MemoryInboxTab: React.FC<MemoryInboxTabProps> = ({ highlightId, conversationId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: proposals, mutate, isLoading } = useSWR(
    'ccb-precipitation.pending',
    () => ipcBridge.ccbPrecipitationService.listPending.invoke(),
    { refreshInterval: 3000 }
  );
  const list = useMemo(() => {
    const all = proposals ?? [];
    if (!conversationId) return all;
    return all.filter((item) => item.conversationId === conversationId);
  }, [conversationId, proposals]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [acting, setActing] = useState(false);

  const selected = useMemo(
    () => list.find((p) => p.id === (selectedId ?? highlightId)) ?? list[0] ?? null,
    [highlightId, list, selectedId]
  );

  useEffect(() => {
    if (selected) {
      setEditContent(selected.content);
      setReviewNote('');
    }
  }, [selected?.id, selected?.content]);

  useEffect(() => {
    if (highlightId) setSelectedId(highlightId);
  }, [highlightId]);

  const runDecision = useCallback(
    async (action: 'approve' | 'deny' | 'approve_edited') => {
      if (!selected) return;
      setActing(true);
      try {
        const result = await ipcBridge.ccbPrecipitationService.decide.invoke({
          proposalId: selected.id,
          action,
          editedContent: action === 'approve_edited' ? editContent : undefined,
          reviewNotes: reviewNote.trim() || undefined,
        });
        if (!result?.ok) {
          const errKey = result?.error === 'org_login_required' ? 'memory.inbox.orgLoginRequired' : 'memory.inbox.actionFailed';
          Message.error(t(errKey, {
            defaultValue:
              result?.error === 'org_login_required'
                ? '写入组织知识库需要先登录组织账号（侧栏 → 知识库）'
                : '操作失败',
          }));
          return;
        }
        Message.success(t('memory.inbox.actionDone', { defaultValue: '已处理' }));
        await mutate();
      } catch (err) {
        Message.error(err instanceof Error ? err.message : t('memory.inbox.actionFailed'));
      } finally {
        setActing(false);
      }
    },
    [editContent, mutate, reviewNote, selected, t]
  );

  if (isLoading && !list.length) {
    return (
      <div className='flex-1 flex items-center justify-center'>
        <Spin />
      </div>
    );
  }

  if (!list.length) {
    return (
      <div className='flex-1 flex items-center justify-center p-24px'>
        <Alert
          type='info'
          content={t('memory.inbox.empty', {
            defaultValue: '暂无待确认沉淀。对话结束约 1 分钟后会自动提取候选条目。',
          })}
        />
      </div>
    );
  }

  return (
    <div className='flex-1 min-h-0 min-w-0 flex gap-14px overflow-hidden'>
      <div className='w-280px shrink-0 flex flex-col gap-8px overflow-y-auto border-r border-[var(--color-border-2)] pr-10px'>
        {list.map((item) => (
          <button
            key={item.id}
            type='button'
            className={`text-left p-10px rd-8px border cursor-pointer transition-colors ${
              selected?.id === item.id
                ? 'border-[var(--color-primary)] bg-[var(--color-fill-2)]'
                : 'border-[var(--color-border-2)] hover:bg-[var(--color-fill-2)]'
            }`}
            onClick={() => setSelectedId(item.id)}
          >
            <div className='flex items-center gap-6px mb-4px'>
              <Tag size='small' color='arcoblue'>
                {LANE_LABEL[item.lane] ?? item.lane}
              </Tag>
              <Typography.Text type='secondary' className='text-12px'>
                {Math.round(item.confidence * 100)}%
              </Typography.Text>
            </div>
            <Typography.Ellipsis className='text-13px text-t-primary' rows={2}>
              {item.title || item.content}
            </Typography.Ellipsis>
          </button>
        ))}
      </div>

      {selected ? (
        <div className='flex-1 min-w-0 flex flex-col gap-12px overflow-y-auto'>
          <div className='flex items-center justify-between gap-8px'>
            <Tag color='orange'>{LANE_LABEL[selected.lane]}</Tag>
            {selected.conversationId ? (
              <Button
                size='mini'
                type='text'
                onClick={() => navigate(`/conversation/${selected.conversationId}`)}
              >
                {t('memory.inbox.viewSession', { defaultValue: '查看来源会话' })}
              </Button>
            ) : null}
          </div>

          <TextArea
            value={editContent}
            onChange={setEditContent}
            autoSize={{ minRows: 4, maxRows: 12 }}
            placeholder={t('memory.inbox.editPlaceholder', { defaultValue: '可编辑后批准' })}
          />

          {selected.evidence.length > 0 ? (
            <div className='p-10px rd-8px bg-[var(--color-fill-2)] border border-[var(--color-border-2)]'>
              <Typography.Text bold className='text-12px'>
                {t('memory.inbox.evidence', { defaultValue: '证据' })}
              </Typography.Text>
              {selected.evidence.map((line) => (
                <Typography.Paragraph key={line.slice(0, 24)} className='text-12px mb-4px text-t-secondary'>
                  {line}
                </Typography.Paragraph>
              ))}
            </div>
          ) : null}

          <TextArea
            value={reviewNote}
            onChange={setReviewNote}
            autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder={t('memory.inbox.clarifyPlaceholder', {
              defaultValue: '澄清备注（批准时一并保存）',
            })}
          />

          <div className='flex flex-wrap gap-8px'>
            <Button type='primary' loading={acting} onClick={() => void runDecision('approve')}>
              {t('memory.inbox.approve', { defaultValue: '批准' })}
            </Button>
            <Button loading={acting} onClick={() => void runDecision('approve_edited')}>
              {t('memory.inbox.approveEdited', { defaultValue: '编辑后批准' })}
            </Button>
            <Button status='danger' loading={acting} onClick={() => void runDecision('deny')}>
              {t('memory.inbox.deny', { defaultValue: '拒绝' })}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
