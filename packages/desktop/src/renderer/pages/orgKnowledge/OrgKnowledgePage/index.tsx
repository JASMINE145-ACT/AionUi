/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input, List, Message, Space, Spin, Tag, Typography } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { isBackendHttpError } from '@/common/adapter/httpBridge';
import { isUnifiedOrgSsoEnabled } from '@/common/auth/ssoMode';
import {
  WANDING_BUSINESS_KNOWLEDGE_SLUG,
  writeWandingBusinessKnowledgeShadowFromDoc,
} from '@/common/auth/orgKnowledgeShadowSync';
import { useOrgAuth } from '@renderer/hooks/context/OrgAuthContext';
import {
  revertOrgKnowledgeDoc,
  saveOrgKnowledgeDoc,
  useOrgKnowledgeDoc,
  useOrgKnowledgeHistory,
} from '@renderer/pages/orgKnowledge/useOrgKnowledge';
import type { OrgKnowledgeRevisionSummary } from '@renderer/pages/orgKnowledge/useOrgKnowledge';

const { TextArea } = Input;

type ChangeKindColor = 'green' | 'arcoblue' | 'orange' | 'gray';

interface ChangeKindConfig {
  labelKey: string;
  color: ChangeKindColor;
}

const CHANGE_KIND_CONFIG: Record<string, ChangeKindConfig> = {
  create: { labelKey: 'orgKnowledge.changeKind.create', color: 'green' },
  update: { labelKey: 'orgKnowledge.changeKind.update', color: 'arcoblue' },
  revert: { labelKey: 'orgKnowledge.changeKind.revert', color: 'orange' },
};

function getVersionLabel(item: OrgKnowledgeRevisionSummary): string {
  if (item.version === 1 || item.change_kind === 'create') {
    return '初始版本';
  }
  if (item.change_kind === 'revert' && item.revert_from_version != null) {
    return `第${item.version}版（回退自 v${item.revert_from_version}）`;
  }
  return `第${item.version}版`;
}

function formatTs(ts: number): string {
  // Handle both seconds (< 1e10) and milliseconds (>= 1e10)
  const ms = ts > 1e10 ? ts : ts * 1000;
  return new Date(ms).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const OrgKnowledgePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { configured, orgStatus, orgUser, orgLogin } = useOrgAuth();
  const { data: doc, error: docError, isLoading: docLoading, mutate: mutateDoc } = useOrgKnowledgeDoc(WANDING_BUSINESS_KNOWLEDGE_SLUG);
  const { data: history, mutate: mutateHistory } = useOrgKnowledgeHistory(WANDING_BUSINESS_KNOWLEDGE_SLUG);
  const [editorContent, setEditorContent] = useState('');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [saving, setSaving] = useState(false);
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

  useEffect(() => {
    if (doc) {
      setEditorContent(doc.content);
    }
  }, [doc?.slug, doc?.version]);

  const dirty = useMemo(() => doc && editorContent !== doc.content, [doc, editorContent]);

  const handleSave = useCallback(async () => {
    if (!doc || !online) return;
    setSaving(true);
    try {
      const saved = await saveOrgKnowledgeDoc({
        slug: WANDING_BUSINESS_KNOWLEDGE_SLUG,
        title: doc.title,
        content: editorContent,
        expected_version: doc.version,
      });
      void writeWandingBusinessKnowledgeShadowFromDoc(saved);
      await Promise.all([mutateDoc(), mutateHistory()]);
      Message.success(t('orgKnowledge.message.saveSuccess'));
    } catch (error) {
      if (isBackendHttpError(error) && error.status === 409) {
        Message.error(t('orgKnowledge.message.conflict'));
        await mutateDoc();
      } else {
        Message.error(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setSaving(false);
    }
  }, [doc, editorContent, mutateDoc, mutateHistory, online, t]);

  const handleRevert = useCallback(
    async (targetVersion: number) => {
      if (!online) return;
      try {
        const reverted = await revertOrgKnowledgeDoc({
          slug: WANDING_BUSINESS_KNOWLEDGE_SLUG,
          target_version: targetVersion,
        });
        void writeWandingBusinessKnowledgeShadowFromDoc(reverted);
        await Promise.all([mutateDoc(), mutateHistory()]);
        Message.success(t('orgKnowledge.message.revertSuccess'));
      } catch (error) {
        Message.error(error instanceof Error ? error.message : String(error));
      }
    },
    [mutateDoc, mutateHistory, online, t]
  );

  const handleOrgLogin = useCallback(async () => {
    const result = await orgLogin({ username: loginUser, password: loginPass });
    if (!result.success) {
      Message.error(result.message ?? t('orgKnowledge.message.loginFailed'));
    }
  }, [loginPass, loginUser, orgLogin, t]);

  if (!configured) {
    return (
      <div className='p-24px'>
        <Alert type='warning' content={t('orgKnowledge.unconfigured')} />
      </div>
    );
  }

  if (orgStatus === 'unauthenticated') {
    if (isUnifiedOrgSsoEnabled()) {
      return (
        <div className='p-24px max-w-480px'>
          <Alert
            type='info'
            content={t('orgKnowledge.loginRequiredUnified', 'Please sign in from the main login screen to access organization knowledge.')}
          />
          <Button className='mt-12px' type='primary' onClick={() => navigate('/login')}>
            {t('orgKnowledge.goToLogin', 'Go to login')}
          </Button>
        </div>
      );
    }

    return (
      <div className='p-24px max-w-400px'>
        <Typography.Title heading={6}>{t('orgKnowledge.loginTitle')}</Typography.Title>
        <Input
          className='mb-12px'
          placeholder={t('orgKnowledge.username')}
          value={loginUser}
          onChange={setLoginUser}
        />
        <Input.Password
          className='mb-12px'
          placeholder={t('orgKnowledge.password')}
          value={loginPass}
          onChange={setLoginPass}
        />
        <Button type='primary' onClick={() => void handleOrgLogin()}>
          {t('orgKnowledge.login')}
        </Button>
      </div>
    );
  }

  return (
    <div className='p-16px flex flex-col h-full min-h-0'>
      {/* Header bar */}
      <div className='mb-10px flex items-center justify-between gap-8px flex-shrink-0'>
        <Space size='small' align='center'>
          <Typography.Title heading={6} style={{ margin: 0 }}>
            {t('orgKnowledge.docTitle')}
          </Typography.Title>
          {doc && (
            <Tag color='arcoblue' size='small'>
              v{doc.version}
            </Tag>
          )}
          {orgUser && (
            <Tag color='green' size='small'>
              {t('orgKnowledge.loggedInAs', { user: orgUser.username })}
            </Tag>
          )}
          {!online && (
            <Tag color='orange' size='small'>
              {t('orgKnowledge.offline')}
            </Tag>
          )}
        </Space>
        <Button
          disabled={!dirty || !online || saving}
          loading={saving}
          type='primary'
          size='small'
          onClick={() => void handleSave()}
        >
          {t('orgKnowledge.save')}
        </Button>
      </div>

      {!online && (
        <Alert className='mb-8px flex-shrink-0' type='warning' content={t('orgKnowledge.offlineReadOnly')} />
      )}

      {/* Editor area */}
      {docLoading ? (
        <div className='flex-1 flex items-center justify-center'>
          <Spin />
        </div>
      ) : docError ? (
        <Alert
          className='flex-shrink-0'
          type='error'
          title={t('orgKnowledge.loadFailed', '无法加载知识库文档')}
          content={
            isBackendHttpError(docError) && docError.status === 404
              ? t(
                  'orgKnowledge.loadFailed404',
                  '组织服务器未提供该文档 API（404）。请确认 VPS aioncore 已部署含 aionui-org-knowledge 的自编译版本并重试。'
                )
              : docError instanceof Error
                ? docError.message
                : String(docError)
          }
        />
      ) : doc ? (
        <TextArea
          className='flex-1 font-mono text-13px'
          style={{ resize: 'none' }}
          value={editorContent}
          onChange={setEditorContent}
          autoSize={false}
        />
      ) : (
        <div className='flex-1 flex items-center justify-center'>
          <Spin />
        </div>
      )}

      {/* History section */}
      {doc && (
        <div className='flex-shrink-0 mt-12px border-t pt-10px max-h-260px overflow-auto'>
          <Typography.Text bold className='mb-6px block text-13px'>
            {t('orgKnowledge.history')}
          </Typography.Text>

          {history && history.length > 0 ? (
            <List
              size='small'
              dataSource={history}
              render={(item: OrgKnowledgeRevisionSummary) => {
                const kindCfg = CHANGE_KIND_CONFIG[item.change_kind] ?? { labelKey: '', color: 'gray' as ChangeKindColor };
                const isCurrentVersion = item.version === doc.version;

                return (
                  <List.Item
                    key={item.id}
                    style={{ padding: '6px 4px' }}
                    actions={
                      isCurrentVersion
                        ? []
                        : [
                            <Button
                              key='revert'
                              size='mini'
                              disabled={!online}
                              onClick={() => void handleRevert(item.version)}
                            >
                              {t('orgKnowledge.revert')}
                            </Button>,
                          ]
                    }
                  >
                    <Space size={6} wrap>
                      <Typography.Text bold className='text-13px'>
                        {getVersionLabel(item)}
                      </Typography.Text>
                      {kindCfg.labelKey && (
                        <Tag color={kindCfg.color} size='small'>
                          {t(kindCfg.labelKey)}
                        </Tag>
                      )}
                      {isCurrentVersion && (
                        <Tag color='arcoblue' size='small'>
                          当前
                        </Tag>
                      )}
                      <Typography.Text type='secondary' className='text-12px'>
                        {t('orgKnowledge.updatedBy', { user: item.updated_by_id })}
                      </Typography.Text>
                      <Typography.Text type='secondary' className='text-12px'>
                        {formatTs(item.created_at)}
                      </Typography.Text>
                    </Space>
                  </List.Item>
                );
              }}
            />
          ) : (
            <Typography.Text type='secondary' className='text-12px'>
              {t('orgKnowledge.noHistory')}
            </Typography.Text>
          )}
        </div>
      )}
    </div>
  );
};

export default OrgKnowledgePage;
