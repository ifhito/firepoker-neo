'use client';

import { useMemo, useState } from 'react';
import type { ProductBacklogItem } from '@/domain/pbi';

interface CreateSessionFormProps {
  pbis: ProductBacklogItem[];
}

type FormStatus =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'success'; sessionId: string }
  | { state: 'error'; message: string };

export function CreateSessionForm({ pbis }: CreateSessionFormProps) {
  const [title, setTitle] = useState('');
  const [facilitatorName, setFacilitatorName] = useState('');
  const [selectedPbiIds, setSelectedPbiIds] = useState<string[]>([]);
  const [status, setStatus] = useState<FormStatus>({ state: 'idle' });

  const selectablePbis = useMemo(() => pbis, [pbis]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedPbiIds.length === 0) {
      setStatus({ state: 'error', message: '少なくとも 1 件の PBI を選択してください。' });
      return;
    }

    if (!facilitatorName.trim()) {
      setStatus({ state: 'error', message: 'ファシリテーター名を入力してください。' });
      return;
    }

    if (!title.trim()) {
      setStatus({ state: 'error', message: 'セッションタイトルを入力してください。' });
      return;
    }

    setStatus({ state: 'submitting' });

    try {
      const facilitatorId = `fac_${Date.now()}`;
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          facilitator: {
            id: facilitatorId,
            name: facilitatorName.trim(),
          },
          pbiIds: selectedPbiIds,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          typeof payload?.message === 'string'
            ? payload.message
            : 'セッション作成中にエラーが発生しました。';
        throw new Error(message);
      }

      const data = (await response.json()) as { sessionId: string };
      setStatus({ state: 'success', sessionId: data.sessionId });
      setTitle('');
      setFacilitatorName('');
      setSelectedPbiIds([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明なエラーが発生しました。';
      setStatus({ state: 'error', message });
    }
  };

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(event.target.selectedOptions).map((option) => option.value);
    setSelectedPbiIds(options);
  };

  const isSubmitting = status.state === 'submitting';

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="badge">新規セッション作成</div>
      <h2>PBI からセッションを作成</h2>
      <p>任意の PBI を選び、即座に見積もりを開始できます。</p>

      <label className="form-label">
        セッションタイトル
        <input
          className="form-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="例: Sprint 15 プランニング"
          disabled={isSubmitting}
        />
      </label>

      <label className="form-label">
        ファシリテーター名
        <input
          className="form-input"
          value={facilitatorName}
          onChange={(event) => setFacilitatorName(event.target.value)}
          placeholder="山田 太郎"
          disabled={isSubmitting}
        />
      </label>

      <label className="form-label">
        対象 PBI (複数選択可)
        <select
          className="form-input"
          multiple
          size={Math.min(selectablePbis.length, 6) || 3}
          value={selectedPbiIds}
          onChange={handleSelectChange}
          disabled={isSubmitting || selectablePbis.length === 0}
        >
          {selectablePbis.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} ({item.storyPoint ?? '未設定'}pt)
            </option>
          ))}
        </select>
      </label>

      <button className="button-primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? '作成中...' : 'セッションを作成'}
      </button>

      {status.state === 'success' && (
        <p className="feedback success">
          セッションを作成しました。ID:
          <code>{status.sessionId}</code>
        </p>
      )}
      {status.state === 'error' && <p className="feedback error">{status.message}</p>}
      {selectablePbis.length === 0 && (
        <p className="feedback warning">登録された PBI がありません。</p>
      )}
    </form>
  );
}
