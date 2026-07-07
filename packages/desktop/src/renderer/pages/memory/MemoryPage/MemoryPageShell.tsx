/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Notes } from '@icon-park/react';
import classNames from 'classnames';

type MemoryPageShellProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  banner?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export const MemoryPageShell: React.FC<MemoryPageShellProps> = ({
  title,
  subtitle,
  actions,
  toolbar,
  banner,
  children,
  className,
}) => (
  <div
    className={classNames(
      'h-full w-full min-w-0 max-w-full box-border overflow-hidden flex flex-col',
      'bg-[var(--color-bg-1)]',
      className
    )}
    data-testid='memory-page'
  >
    <header className='shrink-0 px-20px pt-18px pb-14px border-b border-[var(--color-border-2)] bg-[var(--color-bg-1)]'>
      <div className='flex items-start justify-between gap-16px min-w-0'>
        <div className='flex items-start gap-12px min-w-0'>
          <div
            className='size-40px shrink-0 rd-10px flex items-center justify-center'
            style={{
              background: 'linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(71,85,105,0.08) 100%)',
              color: 'rgb(var(--primary-6))',
            }}
            aria-hidden
          >
            <Notes theme='outline' size={22} fill='currentColor' />
          </div>
          <div className='min-w-0'>
            <h1 className='m-0 text-18px font-600 leading-26px text-t-primary tracking-tight'>{title}</h1>
            {subtitle ? (
              <p className='m-0 mt-4px text-13px leading-20px text-t-secondary max-w-560px'>{subtitle}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className='flex items-center gap-8px shrink-0'>{actions}</div> : null}
      </div>
      {toolbar ? <div className='mt-14px'>{toolbar}</div> : null}
    </header>

    {banner ? <div className='shrink-0 px-20px pt-12px'>{banner}</div> : null}

    <div className='flex-1 min-h-0 min-w-0 px-20px pb-20px pt-12px overflow-hidden flex flex-col'>{children}</div>
  </div>
);

export const MemorySkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className='p-12px space-y-10px animate-pulse' aria-hidden>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className='h-52px rd-8px bg-fill-2' />
    ))}
  </div>
);

export const MemoryEditorSkeleton: React.FC = () => (
  <div className='flex-1 p-20px space-y-12px animate-pulse' aria-hidden>
    <div className='h-14px w-40% rd-4px bg-fill-2' />
    <div className='h-14px w-full rd-4px bg-fill-2' />
    <div className='h-14px w-92% rd-4px bg-fill-2' />
    <div className='h-14px w-78% rd-4px bg-fill-2' />
    <div className='h-14px w-88% rd-4px bg-fill-2' />
  </div>
);
