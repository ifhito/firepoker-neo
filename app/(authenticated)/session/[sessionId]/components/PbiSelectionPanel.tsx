'use client';

import { useMemo, useState } from 'react';
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
}: PbiSelectionPanelProps) {
  const sorted = useMemo(() => sortPbis(pbis), [pbis]);
  const addable = useMemo(
    () => sortPbis(
      availablePbis.filter((item) => 
        !pbis.some((selected) => selected.id === item.id) &&
        (item.storyPoint === null || item.storyPoint === undefined)
      )
    ),
    [availablePbis, pbis],
  );
  const hasJoinToken = Boolean(joinToken);
  const [selectedAddId, setSelectedAddId] = useState<string>('');
  
  const hasPbi = sorted.length > 0;

  return (
    <section className="card">
      <div className="badge">PBI 選択</div>
      <h2>対象 PBI を切り替え</h2>
      {!hasJoinToken && (
        <p className="feedback warning">JoinToken が無いため対象 PBI を変更できません。</p>
      )}
      
      {/* PBIが無い場合のみ追加フォームを表示 */}
      {!hasPbi && onAdd && hasJoinToken && addable.length > 0 && (
        <form
          className="pbi-add-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedAddId) return;
            onAdd(selectedAddId);
            setSelectedAddId('');
          }}
        >
          <label className="form-label" htmlFor="session-add-pbi">
            セッションに PBI を追加
            <select
              id="session-add-pbi"
              className="form-input"
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
            className="button-primary"
            type="submit"
            disabled={!selectedAddId || disabled || isAdding}
          >
            {isAdding ? '追加中...' : '追加する'}
          </button>
        </form>
      )}

      {sorted.length === 0 ? (
        <p>セッションに紐づいた PBI がありません。上のフォームから追加してください。</p>
      ) : (
        <div className="pbi-selection" role="radiogroup" aria-label="見積もり対象 PBI">
          {sorted.map((pbi, index) => {
            const isActive = pbi.id === activePbiId;
            const isPending = selectingId === pbi.id;
            const allowSelection = hasJoinToken && !disabled && !isActive;
            const tabIndex = isActive ? 0 : activePbiId ? -1 : index === 0 ? 0 : -1;
            return (
              <div key={pbi.id} className={`pbi-option-wrapper${isActive ? ' is-selected' : ''}`}>
                <button
                  className={`button-secondary pbi-option${isActive ? ' is-selected' : ''}`}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-disabled={!allowSelection}
                  aria-busy={isPending}
                  tabIndex={tabIndex}
                  data-selected={isActive ? 'true' : undefined}
                  data-pending={isPending ? 'true' : undefined}
                  disabled={!allowSelection || isPending}
                  onClick={() => allowSelection && onSelect(pbi.id)}
                >
                  <span className="pbi-option__title">{pbi.title}</span>
                  <span className="pbi-option__meta">
                    {pbi.storyPoint != null ? `${pbi.storyPoint}pt` : '未見積もり'} · {pbi.status}
                  </span>
                  {pbi.assignee && <span className="pbi-option__assignee">担当: {pbi.assignee}</span>}
                  {pbi.epic && <span className="pbi-option__epic">Epic: {pbi.epic}</span>}
                  {isPending && <span className="pbi-option__pending">切り替え中...</span>}
                  {!isPending && !isActive && (
                    <span className="pbi-option__hint">この PBI を選択</span>
                  )}
                  {isActive && <span className="pbi-option__status">現在の対象</span>}
                </button>
                {onRemove && hasJoinToken && (
                  <button
                    type="button"
                    className="pbi-remove-button"
                    aria-label={`${pbi.title} をセッションから削除`}
                    onClick={() => onRemove(pbi.id)}
                    disabled={disabled || managingId === pbi.id}
                    data-pending={managingId === pbi.id ? 'true' : undefined}
                  >
                    {managingId === pbi.id ? '削除中...' : '削除'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {errorMessage && (
        <p className="feedback error" role="alert">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
