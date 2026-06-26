/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpAskUserQuestion } from '@/common/types/platform/acpTypes';
import { Button, Input, Spin, Tag, Typography } from '@arco-design/web-react';
import { CheckOne, Help } from '@icon-park/react';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import AskUserQuestionNavBar from './AskUserQuestionNavBar';
import {
  hasStructuredPriceColumn,
  parseAskUserOption,
  shouldRenderAskUserTable,
  type ParsedAskUserOption,
} from './askUserQuestionFormat';

const { Text } = Typography;

export type AskUserChoiceRow = {
  option_id: string;
  label: string;
  description?: string;
  isCancel?: boolean;
};

type MessageAskUserQuestionCardProps = {
  question: AcpAskUserQuestion;
  allQuestions: AcpAskUserQuestion[];
  activeQuestionIndex: number;
  existingAnswers: Record<string, string>;
  choices: AskUserChoiceRow[];
  multiSelect: boolean;
  selectedOptionIds: string[];
  onToggleSelect: (optionId: string) => void;
  onConfirm: () => void;
  customAnswer: string;
  onCustomAnswerChange: (value: string) => void;
  isResponding: boolean;
  hasResponded: boolean;
  isAwaitingNextQuestion: boolean;
  awaitingNextTimedOut: boolean;
  isAgentGenerating: boolean;
  responseStatus: 'success' | 'cancelled' | null;
};

function buildParsedRows(choices: AskUserChoiceRow[]): ParsedAskUserOption[] {
  return choices.filter((c) => !c.isCancel).map((c) => parseAskUserOption(c.label, c.description));
}

const SelectionIndicator: React.FC<{ selected: boolean; multiSelect: boolean }> = ({
  selected,
  multiSelect,
}) => (
  <span
    className={classNames(
      'size-18px flex items-center justify-center shrink-0 transition-all border-2',
      multiSelect ? 'rd-4px' : 'rd-full',
      selected ? 'border-[rgb(var(--primary-6))] bg-[rgb(var(--primary-6))]' : 'border-border-3 bg-base'
    )}
    aria-hidden
  >
    {selected ? <CheckOne theme='filled' size={12} fill='#fff' /> : null}
  </span>
);

const MessageAskUserQuestionCard: React.FC<MessageAskUserQuestionCardProps> = ({
  question,
  allQuestions,
  activeQuestionIndex,
  existingAnswers,
  choices,
  multiSelect,
  selectedOptionIds,
  onToggleSelect,
  onConfirm,
  customAnswer,
  onCustomAnswerChange,
  isResponding,
  hasResponded,
  isAwaitingNextQuestion,
  awaitingNextTimedOut,
  isAgentGenerating,
  responseStatus,
}) => {
  const { t } = useTranslation();
  const candidateChoices = choices.filter((c) => !c.isCancel);
  const cancelChoice = choices.find((c) => c.isCancel);
  const optionInputs = candidateChoices.map((c) => ({ label: c.label, description: c.description }));
  const useTable = shouldRenderAskUserTable(optionInputs);
  const showPriceColumn = hasStructuredPriceColumn(optionInputs);
  const parsedRows = buildParsedRows(choices);

  const selectedCandidateIds = selectedOptionIds.filter((id) => id !== 'reject');
  const selectedLabels = candidateChoices
    .filter((c) => selectedCandidateIds.includes(c.option_id))
    .map((c) => c.label);

  const canConfirm =
    customAnswer.trim().length > 0 ||
    selectedOptionIds.includes('reject') ||
    (multiSelect ? selectedCandidateIds.length > 0 : selectedCandidateIds.length === 1);

  const displaySelectedLabel =
    customAnswer.trim().length > 0 ? customAnswer.trim() : selectedLabels.join(multiSelect ? '、' : '');

  const rowClass = (isSelected: boolean) =>
    classNames(
      'cursor-pointer transition-all border-t border-border-2',
      isSelected
        ? 'bg-[rgb(var(--primary-1))] shadow-[inset_3px_0_0_0_rgb(var(--primary-6))]'
        : 'hover:bg-fill-2'
    );

  const renderTableBody = (
    rows: AskUserChoiceRow[],
    renderCells: (choice: AskUserChoiceRow, index: number, isSelected: boolean) => React.ReactNode
  ) =>
    rows.map((choice, index) => {
      const isSelected = selectedOptionIds.includes(choice.option_id);
      return (
        <tr
          key={choice.option_id}
          data-testid={`message-acp-permission-option-${choice.option_id}`}
          data-selected={isSelected ? 'true' : 'false'}
          className={rowClass(isSelected)}
          onClick={() => onToggleSelect(choice.option_id)}
        >
          {renderCells(choice, index, isSelected)}
        </tr>
      );
    });

  return (
    <div
      className='mb-4 rd-12px border border-border-2 overflow-hidden shadow-sm'
      style={{
        background: 'linear-gradient(135deg, var(--color-fill-1) 0%, var(--color-bg-1) 100%)',
        borderLeftWidth: 4,
        borderLeftColor: 'rgb(var(--primary-6))',
      }}
      data-testid='message-ask-user-question-card'
    >
      <AskUserQuestionNavBar
        questions={allQuestions}
        activeIndex={activeQuestionIndex}
        answers={existingAnswers}
      />

      <div className='px-16px py-14px border-b border-border-2 bg-fill-1/80'>
        <div className='flex items-start gap-10px'>
          <span
            className='size-32px rd-8px flex items-center justify-center shrink-0'
            style={{ background: 'rgb(var(--primary-1))', color: 'rgb(var(--primary-6))' }}
          >
            <Help theme='outline' size={18} strokeWidth={3} />
          </span>
          <div className='flex-1 min-w-0'>
            {question.header ? (
              <Tag size='small' color='arcoblue' className='mb-6px'>
                {question.header}
              </Tag>
            ) : null}
            <Text className='block text-15px font-500 text-t-primary leading-22px'>{question.question}</Text>
            <Text type='secondary' className='block text-12px mt-4px'>
              {multiSelect
                ? t('messages.askUserQuestion.hintMulti', {
                    defaultValue: '可多选，选完后点确认（此为待您确认的操作）',
                  })
                : t('messages.askUserQuestion.hint', {
                    defaultValue: '可点选表格，或在下方直接输入你的回答',
                  })}
            </Text>
            <Text type='secondary' className='block text-12px mt-2px'>
              {t('messages.askUserQuestion.chatHint', {
                defaultValue: '也可以点「取消」后，在聊天输入框继续用文字说明。',
              })}
            </Text>
          </div>
        </div>
      </div>

      {isAwaitingNextQuestion ? (
        <div
          className='px-12px py-20px flex items-center justify-center gap-10px text-13px text-t-secondary'
          data-testid='ask-user-question-awaiting-next'
        >
          <Spin size={16} />
          {isAgentGenerating
            ? t('messages.askUserQuestion.awaitingNextWhileThinking', {
                defaultValue: '已提交，代理思考中，正在加载下一题…',
              })
            : t('messages.askUserQuestion.awaitingNext', {
                defaultValue: '已提交，正在加载下一题…',
              })}
        </div>
      ) : !hasResponded ? (
        <div className='px-12px py-12px'>
          {awaitingNextTimedOut ? (
            <div
              className='mb-12px p-10px rd-8px border'
              style={{ backgroundColor: 'var(--color-warning-light-1)', borderColor: 'rgb(var(--warning-3))' }}
              data-testid='ask-user-question-awaiting-timeout'
            >
              <Text className='text-sm' style={{ color: 'rgb(var(--warning-6))' }}>
                {t('messages.askUserQuestion.awaitingTimeout', {
                  defaultValue:
                    '下一题加载较慢。你的上一题答案可能已提交；请在此继续作答，或在聊天输入框用文字补充剩余问题。',
                })}
              </Text>
            </div>
          ) : null}
          {useTable ? (
            <div className='overflow-x-auto rd-8px border border-border-2 bg-base'>
              <table className='w-full text-13px border-collapse ask-user-question-table'>
                <thead>
                  <tr className='bg-fill-2 text-t-secondary text-12px'>
                    <th className='px-10px py-8px text-left font-500 w-36px' aria-label='select' />
                    <th className='px-10px py-8px text-left font-500 w-36px'>#</th>
                    <th className='px-12px py-8px text-left font-500 min-w-140px'>
                      {t('messages.askUserQuestion.colCandidate', { defaultValue: '候选' })}
                    </th>
                    <th className='px-12px py-8px text-left font-500 w-110px'>
                      {t('messages.askUserQuestion.colCode', { defaultValue: '编码' })}
                    </th>
                    {showPriceColumn ? (
                      <th className='px-12px py-8px text-right font-500 w-110px'>
                        {t('messages.askUserQuestion.colPrice', { defaultValue: '单价' })}
                      </th>
                    ) : null}
                    <th className='px-12px py-8px text-left font-500 min-w-120px'>
                      {t('messages.askUserQuestion.colNote', { defaultValue: '说明' })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {renderTableBody(candidateChoices, (choice, index, isSelected) => {
                    const parsed = parsedRows[index];
                    return (
                      <React.Fragment key={choice.option_id}>
                        <td className='px-10px py-10px'>
                          <SelectionIndicator selected={isSelected} multiSelect={multiSelect} />
                        </td>
                        <td className='px-10px py-10px text-t-tertiary tabular-nums'>{index + 1}</td>
                        <td className={classNames('px-12px py-10px text-t-primary', isSelected ? 'font-600' : 'font-500')}>
                          {parsed.label}
                        </td>
                        <td className='px-12px py-10px text-t-primary font-mono text-12px'>{parsed.code ?? '—'}</td>
                        {showPriceColumn ? (
                          <td
                            className={classNames(
                              'px-12px py-10px text-right tabular-nums',
                              isSelected ? 'text-[rgb(var(--primary-6))] font-600' : 'text-t-primary'
                            )}
                          >
                            {parsed.priceDisplay ?? '—'}
                          </td>
                        ) : null}
                        <td className='px-12px py-10px text-t-secondary text-12px leading-18px'>
                          {parsed.note ?? (parsed.priceDisplay ? '—' : parsed.description) ?? '—'}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className='overflow-x-auto rd-8px border border-border-2 bg-base'>
              <table className='w-full text-13px border-collapse ask-user-question-table'>
                <thead>
                  <tr className='bg-fill-2 text-t-secondary text-12px'>
                    <th className='px-10px py-8px text-left font-500 w-36px' aria-label='select' />
                    <th className='px-10px py-8px text-left font-500 w-36px'>#</th>
                    <th className='px-12px py-8px text-left font-500 min-w-120px'>
                      {t('messages.askUserQuestion.colOption', { defaultValue: '选项' })}
                    </th>
                    <th className='px-12px py-8px text-left font-500'>
                      {t('messages.askUserQuestion.colDescription', { defaultValue: '说明' })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {renderTableBody(candidateChoices, (choice, index, isSelected) => (
                    <React.Fragment key={choice.option_id}>
                      <td className='px-10px py-10px'>
                        <SelectionIndicator selected={isSelected} multiSelect={multiSelect} />
                      </td>
                      <td className='px-10px py-10px text-t-tertiary tabular-nums'>{index + 1}</td>
                      <td className={classNames('px-12px py-10px text-t-primary', isSelected ? 'font-600' : 'font-500')}>
                        {choice.label}
                      </td>
                      <td className='px-12px py-10px text-t-secondary text-12px leading-18px'>
                        {choice.description ?? '—'}
                      </td>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isAwaitingNextQuestion ? (
            <div className='px-12px mt-10px'>
              <Input.TextArea
                value={customAnswer}
                onChange={onCustomAnswerChange}
                placeholder={t('messages.askUserQuestion.customPlaceholder', {
                  defaultValue: '在此输入你的回答（不必点选表格）…',
                })}
                autoSize={{ minRows: 2, maxRows: 5 }}
                data-testid='ask-user-question-custom-answer'
              />
            </div>
          ) : null}

          {displaySelectedLabel ? (
            <div
              className='mt-10px px-12px py-8px rd-8px text-13px flex items-center gap-8px'
              style={{ background: 'rgb(var(--primary-1))', color: 'rgb(var(--primary-6))' }}
              data-testid='message-ask-user-question-selected-summary'
            >
              <CheckOne theme='filled' size={16} />
              <span>
                {t('messages.askUserQuestion.selected', { defaultValue: '已选' })}：
                <strong className='font-600'>{displaySelectedLabel}</strong>
              </span>
            </div>
          ) : null}

          <div className='flex items-center justify-between gap-12px mt-12px px-4px'>
            {cancelChoice ? (
              <Button
                type='text'
                size='small'
                className={classNames({
                  '!text-[rgb(var(--primary-6))] font-600': selectedOptionIds.includes('reject'),
                })}
                onClick={() => onToggleSelect(cancelChoice.option_id)}
                data-testid={`message-acp-permission-option-${cancelChoice.option_id}`}
              >
                {cancelChoice.label}
              </Button>
            ) : (
              <span />
            )}
            <Button
              type='primary'
              size='small'
              disabled={!canConfirm || isResponding}
              onClick={onConfirm}
              data-testid='message-acp-permission-confirm'
            >
              {isResponding
                ? t('messages.processing')
                : activeQuestionIndex < allQuestions.length - 1
                  ? t('messages.askUserQuestion.next', { defaultValue: '确认并下一题' })
                  : t('messages.confirm')}
            </Button>
          </div>
        </div>
      ) : responseStatus === 'cancelled' ? (
        <div
          className='mx-12px mb-12px mt-12px p-10px rd-8px border'
          style={{ backgroundColor: 'var(--color-fill-2)', borderColor: 'var(--color-border-2)' }}
          data-testid='ask-user-question-cancelled'
        >
          <Text className='text-sm text-t-secondary'>
            {t('messages.askUserQuestion.cancelled', { defaultValue: '已取消' })}
          </Text>
        </div>
      ) : (
        <div
          className='mx-12px mb-12px mt-12px p-10px rd-8px border'
          style={{ backgroundColor: 'var(--color-success-light-1)', borderColor: 'rgb(var(--success-3))' }}
        >
          <Text className='text-sm' style={{ color: 'rgb(var(--success-6))' }}>
            ✓ {t('messages.responseSentSuccessfully')}
          </Text>
        </div>
      )}
    </div>
  );
};

export default MessageAskUserQuestionCard;
