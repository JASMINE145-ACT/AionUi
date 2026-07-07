/**

 * @license

 * Copyright 2025 AionUi (aionui.com)

 * SPDX-License-Identifier: Apache-2.0

 */



import React, { useCallback, useEffect, useState } from 'react';

import { Alert, Button, Message, Spin } from '@arco-design/web-react';

import { IconRefresh, IconSave } from '@arco-design/web-react/icon';

import { useTranslation } from 'react-i18next';

import { useSearchParams } from 'react-router-dom';

import { ipcBridge } from '@/common';

import type { MemoryFileSummary, MemoryScope } from '@/common/config/ccbMemoryFiles';

import { useCcbAuthorityActive } from '@/renderer/hooks/agent/useCcbModelInfo';

import useSWR from 'swr';

import { MemoryEditorPanel } from './MemoryEditorPanel';

import { MemoryEmptyPanel } from './MemoryEmptyPanel';

import { MemoryFileSidebar } from './MemoryFileSidebar';

import { MemoryPageShell } from './MemoryPageShell';

import { MemoryScopeTabs } from './MemoryScopeTabs';



const IPC_TIMEOUT_MS = 8_000;



function isMemoryScope(value: string | null): value is MemoryScope {

  return value === 'personal' || value === 'business';

}



async function invokeWithTimeout<T>(promise: Promise<T>, ms = IPC_TIMEOUT_MS): Promise<T> {

  let timer: ReturnType<typeof setTimeout> | undefined;

  try {

    return await Promise.race([

      promise,

      new Promise<T>((_, reject) => {

        timer = setTimeout(() => reject(new Error('IPC timeout')), ms);

      }),

    ]);

  } finally {

    if (timer !== undefined) clearTimeout(timer);

  }

}



const MemoryPage: React.FC = () => {

  const { t } = useTranslation();

  const { active: ccbActive, isLoading: authorityLoading } = useCcbAuthorityActive();

  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');

  const scope: MemoryScope = isMemoryScope(tabParam) ? tabParam : 'personal';



  const [selectedRel, setSelectedRel] = useState<string | null>(null);

  const [editorContent, setEditorContent] = useState('');

  const [dirty, setDirty] = useState(false);

  const [saving, setSaving] = useState(false);



  const listKey = ccbActive ? `ccb-memory.list.${scope}` : null;

  const {

    data: files,

    error: listError,

    isLoading: listLoading,

    isValidating: listValidating,

    mutate: mutateList,

  } = useSWR<MemoryFileSummary[]>(

    listKey,

    () => invokeWithTimeout(ipcBridge.ccbPersonalMemoryService.listFiles.invoke({ scope })),

    {

      shouldRetryOnError: false,

      revalidateOnFocus: false,

      errorRetryCount: 0,

    }

  );



  const fileList = files ?? [];

  const listBusy = listLoading && !listError && files === undefined;



  useEffect(() => {

    setSelectedRel(null);

    setEditorContent('');

    setDirty(false);

  }, [scope]);



  useEffect(() => {

    if (!fileList.length) {

      setSelectedRel(null);

      return;

    }

    if (selectedRel && fileList.some((f) => f.relPath === selectedRel)) {

      return;

    }

    setSelectedRel(fileList[0].relPath);

  }, [fileList, selectedRel]);



  const contentKey = ccbActive && selectedRel ? `ccb-memory.file.${selectedRel}` : null;

  const {

    data: fileContent,

    error: readError,

    isLoading: readLoading,

    mutate: mutateContent,

  } = useSWR(

    contentKey,

    () =>

      invokeWithTimeout(

        ipcBridge.ccbPersonalMemoryService.readFile.invoke({ relPath: selectedRel! })

      ),

    {

      shouldRetryOnError: false,

      revalidateOnFocus: false,

      errorRetryCount: 0,

    }

  );



  useEffect(() => {

    if (fileContent) {

      setEditorContent(fileContent.content);

      setDirty(false);

    }

  }, [fileContent?.relPath, fileContent?.content]);



  const setScope = useCallback(

    (next: MemoryScope) => {

      setSearchParams(next === 'personal' ? {} : { tab: next }, { replace: true });

    },

    [setSearchParams]

  );



  const handleRefresh = useCallback(() => {

    void mutateList();

    if (selectedRel) void mutateContent();

  }, [mutateContent, mutateList, selectedRel]);



  const handleSave = useCallback(async () => {

    if (!selectedRel) return;

    setSaving(true);

    try {

      await invokeWithTimeout(

        ipcBridge.ccbPersonalMemoryService.writeFile.invoke({

          relPath: selectedRel,

          content: editorContent,

        })

      );

      setDirty(false);

      Message.success(t('memory.saved'));

      await mutateContent();

      await mutateList();

    } catch (err) {

      Message.error(err instanceof Error ? err.message : t('memory.saveFailed'));

    } finally {

      setSaving(false);

    }

  }, [editorContent, mutateContent, mutateList, selectedRel, t]);



  const scopeEmpty = !listBusy && !listError && fileList.length === 0;

  const emptySidebarMessage =

    scope === 'business' ? t('memory.businessEmpty') : t('memory.personalEmpty');



  const loadErrorMessage =

    listError instanceof Error && listError.message === 'IPC timeout'

      ? t('memory.loadTimeout')

      : t('memory.loadFailed');



  const headerActions = (

    <>

      <Button size='small' icon={<IconRefresh />} loading={listValidating} onClick={handleRefresh}>

        {t('common.refresh', { defaultValue: '刷新' })}

      </Button>

      <Button

        size='small'

        type='primary'

        icon={<IconSave />}

        loading={saving}

        disabled={!selectedRel || !dirty}

        onClick={() => void handleSave()}

      >

        {t('memory.save')}

      </Button>

    </>

  );



  if (authorityLoading) {

    return (

      <div className='h-full w-full min-w-0 flex items-center justify-center bg-[var(--color-bg-1)]'>

        <Spin />

      </div>

    );

  }



  if (!ccbActive) {

    return (

      <div className='h-full w-full min-w-0 box-border p-24px overflow-auto bg-[var(--color-bg-1)]'>

        <Alert type='warning' content={t('memory.ccbRequired')} />

      </div>

    );

  }



  return (

    <MemoryPageShell

      title={t('memory.title')}

      subtitle={t('memory.subtitle')}

      actions={headerActions}

      toolbar={<MemoryScopeTabs scope={scope} onChange={setScope} />}

      banner={

        (listError || readError) ? (

          <Alert

            type='error'

            content={loadErrorMessage}

            action={

              <Button size='mini' type='text' onClick={handleRefresh}>

                {t('common.refresh', { defaultValue: '刷新' })}

              </Button>

            }

          />

        ) : null

      }

    >

      {scopeEmpty ? (

        <MemoryEmptyPanel scope={scope} />

      ) : (

        <div className='flex-1 min-h-0 min-w-0 flex gap-14px overflow-hidden'>

          <MemoryFileSidebar

            files={fileList}

            selectedRel={selectedRel}

            loading={listBusy}

            emptyMessage={emptySidebarMessage}

            onSelect={setSelectedRel}

          />

          <MemoryEditorPanel

            relPath={readError ? null : selectedRel}

            content={editorContent}

            dirty={dirty}

            loading={Boolean(readLoading && selectedRel && !readError)}

            placeholder={t('memory.selectFile')}

            onChange={(value) => {

              setEditorContent(value);

              setDirty(true);

            }}

          />

        </div>

      )}

    </MemoryPageShell>

  );

};



export default MemoryPage;


