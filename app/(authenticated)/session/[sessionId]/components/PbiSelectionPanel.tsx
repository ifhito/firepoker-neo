'use client';

import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import type { ProductBacklogItem } from '@/domain/pbi';

interface PbiSelectionPanelProps {
  pbis: ProductBacklogItem[];
  availablePbis: ProductBacklogItem[];
  activePbiId: string | null;
  selectingId: string | null;
  disabled: boolean;
  joinToken: string | null;
  errorMessage?: string | null;
  onSelect: (pbiId: string) => void;
  onAdd?: (pbiId: string) => void;
  onRemove?: (pbiId: string) => void;
  managingId?: string | null;
  isAdding?: boolean;
  excludedPbiIds?: string[];
  canManage?: boolean;
}

const sortPbis = (pbis: ProductBacklogItem[]) =>
  [...pbis].sort((a, b) => a.title.localeCompare(b.title, 'ja'));

export default function PbiSelectionPanel({
  pbis,
  availablePbis,
  activePbiId,
  selectingId,
  disabled,
  joinToken,
  errorMessage,
  onSelect,
  onAdd,
  onRemove,
  managingId,
  isAdding,
  excludedPbiIds = [],
  canManage = false,
}: PbiSelectionPanelProps) {
  const sorted = useMemo(() => sortPbis(pbis), [pbis]);
  const addable = useMemo(
    () =>
      sortPbis(
        availablePbis.filter(
          (item) =>
            !pbis.some((selected) => selected.id === item.id) &&
            (item.storyPoint === null || item.storyPoint === undefined) &&
            !excludedPbiIds.includes(item.id),
        ),
      ),
    [availablePbis, pbis, excludedPbiIds],
  );

  const hasJoinToken = Boolean(joinToken);
  const [selectedAddId, setSelectedAddId] = useState<string>('');
  const activeIndex = activePbiId ? sorted.findIndex((item) => item.id === activePbiId) : -1;
  const activePbi = activeIndex >= 0 ? sorted[activeIndex] : null;
  const hasPbi = sorted.length > 0;
  const shouldShowAddForm = Boolean(canManage && onAdd && hasJoinToken && addable.length > 0 && !hasPbi);

  const handleSelect = useCallback(
    (pbiId: string) => {
      if (!hasJoinToken || disabled) {
        return;
      }
      if (pbiId === activePbiId) {
        return;
      }
      onSelect(pbiId);
    },
    [activePbiId, disabled, hasJoinToken, onSelect],
  );

  return (
    <section className="session-card session-card--current">
      <header className="session-card__header">
        <div>
          <span className="session-card__eyebrow">現在の PBI</span>
          <h2 className="session-card__title">{activePbi ? activePbi.title : '見積もり対象を選択'}</h2>
        </div>
        <span className="session-card__counter">
          {hasPbi && activeIndex >= 0 ? `${activeIndex + 1} / ${sorted.length}` : '0 / 0'}
        </span>
      </header>

      {!hasJoinToken && (
        <p className="session-inline-alert session-inline-alert--warning">
          JoinToken が無いため対象 PBI を変更できません。
        </p>
      )}

      {hasPbi ? (
        <div className="session-current__list">
          {sorted.map((pbi) => {
            const isActive = pbi.id === activePbiId;
            const isPending = selectingId === pbi.id;
            const isRemoving = managingId === pbi.id;
            const allowSelection = hasJoinToken && canManage && !disabled && !isActive && !isPending;

            const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
              if (!allowSelection) {
                return;
              }
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleSelect(pbi.id);
              }
            };
            return (
              <div
                key={pbi.id}
                className={`session-current__item${isActive ? ' is-active' : ''}${
                  isPending ? ' is-pending' : ''
                }`}
                data-pbi-id={pbi.id}
                role={allowSelection ? 'button' : 'group'}
                tabIndex={allowSelection ? 0 : -1}
                onClick={() => {
                  if (!allowSelection) return;
                  handleSelect(pbi.id);
                }}
                onKeyDown={handleKeyDown}
                aria-pressed={isActive}
              >
                <div className="session-current__item-body">
                  <span className="session-current__item-title">{pbi.title}</span>
                  <div className="session-current__item-meta">
                    <span className="session-current__item-chip session-current__item-chip--primary">
                      {pbi.storyPoint != null ? `${pbi.storyPoint} pt` : '未見積もり'}
                    </span>
                    {pbi.status && (
                      <span className="session-current__item-chip">{pbi.status}</span>
                    )}
                    {pbi.assignee && (
                      <span className="session-current__item-chip">担当: {pbi.assignee}</span>
                    )}
                    {pbi.epic && <span className="session-current__item-chip">Epic: {pbi.epic}</span>}
                  </div>
                </div>
                <div className="session-current__item-actions">
                  {onRemove && hasJoinToken && canManage && (
                    <button
                      type="button"
                      className="session-current__item-remove"
                      aria-label={`${pbi.title} をセッションから削除`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove(pbi.id);
                      }}
                      disabled={disabled || isRemoving}
                      data-pending={isRemoving ? 'true' : undefined}
                    >
                      {isRemoving ? '…' : '×'}
                    </button>
                  )}
                  {pbi.notionUrl && (
                    <a
                      className="session-current__notion-link"
                      href={pbi.notionUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`${pbi.title} を Notion で開く`}
                    >
                      <img aria-hidden="true" className="notion-icon" src="/icons/notion-logo.svg" alt="" />
                    </a>
                  )}
                </div>
                {isPending && <span className="session-current__item-status">切り替え中…</span>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="session-card__empty">
          {canManage
            ? 'セッションに紐づく PBI がありません。下のフォームから追加してください。'
            : 'ホストが見積もり対象を設定するまでお待ちください。'}
        </div>
      )}

      {shouldShowAddForm && onAdd && (
        <form
          className="session-current__add"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedAddId) return;
            onAdd(selectedAddId);
            setSelectedAddId('');
          }}
        >
          <label className="session-current__add-label" htmlFor="session-add-pbi">
            <span>セッションに PBI を追加</span>
            <select
              id="session-add-pbi"
              className="session-current__select"
              value={selectedAddId}
              onChange={(event) => setSelectedAddId(event.target.value)}
            >
              <option value="">PBI を選択...</option>
              {addable.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({item.storyPoint ?? '未設定'}pt)
                </option>
              ))}
            </select>
          </label>
          <button
            className="session-button session-button--primary"
            type="submit"
            disabled={!selectedAddId || disabled || Boolean(isAdding)}
          >
            {isAdding ? '追加中…' : '追加する'}
          </button>
        </form>
      )}

      {errorMessage && (
        <p className="session-inline-alert session-inline-alert--error" role="alert">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
