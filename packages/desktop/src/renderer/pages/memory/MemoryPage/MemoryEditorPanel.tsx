/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Input } from '@arco-design/web-react';
import { FileText } from '@icon-park/react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { countLines } from './memoryPageUtils';
import { MemoryEditorSkeleton } from './MemoryPageShell';

const { TextArea } = Input;

type MemoryEditorPanelProps = {
  relPath: string | null;
  content: string;
  dirty: boolean;
  loading: boolean;
  placeholder: string;
  onChange: (value: string) => void;
};

export const MemoryEditorPanel: React.FC<MemoryEditorPanelProps> = ({
  relPath,
  content,
  dirty,
  loading,
  placeholder,
  onChange,
}) => {
  const { t } = useTranslation();
  const lines = countLines(content);

  if (!relPath) {
    return (
      <section
        className='flex-1 min-w-0 min-h-0 flex flex-col items-center justify-center rd-12px border border-dashed border-[var(--color-border-2)] bg-[var(--color-bg-2)]'
        data-testid='memory-editor-empty'
      >
        <div className='size-56px rd-14px flex items-center justify-center bg-fill-2 text-t-tertiary mb-12px'>
          <FileText theme='outline' size={28} fill='currentColor' />
        </div>
        <p className='m-0 text-14px font-500 text-t-primary'>{placeholder}</p>
        <p className='m-0 mt-6px text-12px text-t-tertiary max-w-320px text-center px-16px'>
          {t('memory.selectFileHint', {
            defaultValue: 'Choose a file from the list to view or edit Markdown content.',
          })}
        </p>
      </section>
    );
  }

  return (
    <section
      className='flex-1 min-w-0 min-h-0 flex flex-col rd-12px border border-[var(--color-border-2)] bg-[var(--color-bg-2)] overflow-hidden shadow-sm'
      data-testid='memory-editor-panel'
    >
      <div className='shrink-0 flex items-center justify-between gap-12px px-16px py-10px border-b border-[var(--color-border-2)] bg-[var(--color-bg-1)]'>
        <div className='flex items-center gap-8px min-w-0'>
          <FileText theme='outline' size={16} fill='currentColor' className='shrink-0 text-t-secondary' />
          <code className='text-12px font-mono text-t-secondary truncate'>{relPath}</code>
        </div>
        <div className='flex items-center gap-10px shrink-0 text-12px text-t-tertiary'>
          {dirty ? (
            <span
              className='inline-flex items-center gap-4px text-[rgb(var(--orange-6))] font-500'
              data-testid='memory-dirty-indicator'
            >
              <span className='size-6px rd-full bg-[rgb(var(--orange-6))]' aria-hidden />
              {t('memory.unsaved', { defaultValue: 'Unsaved' })}
            </span>
          ) : (
            <span className='text-t-tertiary'>{t('memory.savedState', { defaultValue: 'Saved' })}</span>
          )}
          <span aria-hidden>·</span>
          <span>{t('memory.lineCount', { count: lines, defaultValue: '{{count}} lines' })}</span>
        </div>
      </div>

      <div className='flex-1 min-h-0 relative'>
        {loading ? (
          <MemoryEditorSkeleton />
        ) : (
          <TextArea
            className={classNames(
              '!absolute !inset-0 !h-full !min-h-0 !border-none !rounded-none',
              '!bg-[var(--color-bg-2)] !font-mono !text-13px !leading-22px !text-t-primary',
              '!px-16px !py-14px focus:!shadow-none'
            )}
            style={{ resize: 'none' }}
            value={content}
            placeholder={placeholder}
            onChange={onChange}
            spellCheck={false}
          />
        )}
      </div>
    </section>
  );
};
