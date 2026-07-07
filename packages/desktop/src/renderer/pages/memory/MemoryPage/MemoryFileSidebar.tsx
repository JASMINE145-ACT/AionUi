/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { MemoryFileSummary } from '@/common/config/ccbMemoryFiles';
import { BranchTwo, FileText, User } from '@icon-park/react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import {
  formatMemoryFileTime,
  getMemoryFileDescriptionKey,
  getMemoryFileKind,
  type MemoryFileKind,
} from './memoryPageUtils';
import { MemorySkeleton } from './MemoryPageShell';

type MemoryFileSidebarProps = {
  files: MemoryFileSummary[];
  selectedRel: string | null;
  loading: boolean;
  emptyMessage: string;
  onSelect: (relPath: string) => void;
};

const FILE_ICONS: Record<MemoryFileKind, React.ReactNode> = {
  profile: <User theme='outline' size={16} fill='currentColor' />,
  workflow: <BranchTwo theme='outline' size={16} fill='currentColor' />,
  default: <FileText theme='outline' size={16} fill='currentColor' />,
};

export const MemoryFileSidebar: React.FC<MemoryFileSidebarProps> = ({
  files,
  selectedRel,
  loading,
  emptyMessage,
  onSelect,
}) => {
  const { t } = useTranslation();

  return (
    <aside
      className='w-220px max-w-[34%] shrink-0 flex flex-col min-h-0 rd-12px border border-[var(--color-border-2)] bg-[var(--color-bg-2)] overflow-hidden'
      aria-label={t('memory.fileList', { defaultValue: 'Memory files' })}
    >
      <div className='shrink-0 px-14px py-10px border-b border-[var(--color-border-2)]'>
        <span className='text-12px font-600 uppercase tracking-wide text-t-tertiary'>
          {t('memory.filesHeading', { defaultValue: 'Files' })}
        </span>
        {!loading && files.length > 0 ? (
          <span className='ml-6px text-12px text-t-tertiary'>({files.length})</span>
        ) : null}
      </div>

      <div className='flex-1 min-h-0 overflow-y-auto'>
        {loading ? (
          <MemorySkeleton rows={3} />
        ) : files.length === 0 ? (
          <div className='p-16px text-13px leading-20px text-t-secondary'>{emptyMessage}</div>
        ) : (
          <ul className='m-0 p-6px list-none'>
            {files.map((file) => {
              const active = selectedRel === file.relPath;
              const kind = getMemoryFileKind(file.name);
              return (
                <li key={file.relPath}>
                  <button
                    type='button'
                    className={classNames(
                      'w-full text-left px-10px py-10px mb-4px rd-8px border-none cursor-pointer transition-all duration-150',
                      'flex items-start gap-10px outline-none',
                      active
                        ? 'bg-[rgba(var(--primary-6),0.08)] ring-1 ring-[rgba(var(--primary-6),0.25)]'
                        : 'bg-transparent hover:bg-fill-2'
                    )}
                    onClick={() => onSelect(file.relPath)}
                    data-testid={`memory-file-${file.name}`}
                    title={file.name}
                  >
                    <span
                      className={classNames(
                        'size-32px shrink-0 rd-8px flex items-center justify-center',
                        active ? 'text-[rgb(var(--primary-6))] bg-[rgba(var(--primary-6),0.12)]' : 'text-t-secondary bg-fill-2'
                      )}
                    >
                      {FILE_ICONS[kind]}
                    </span>
                    <span className='min-w-0 flex-1'>
                      <span
                        className={classNames(
                          'block text-13px leading-20px truncate',
                          active ? 'font-600 text-t-primary' : 'font-500 text-t-primary'
                        )}
                      >
                        {file.name}
                      </span>
                      <span className='block text-11px leading-16px text-t-tertiary truncate mt-2px'>
                        {t(getMemoryFileDescriptionKey(file), {
                          defaultValue: 'Markdown memory file',
                        })}
                      </span>
                      <span className='block text-11px leading-16px text-t-tertiary mt-2px'>
                        {formatMemoryFileTime(file.mtimeMs)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
};
