'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductBacklogItem } from '@/domain/pbi';
import { buildSessionEntryPath, persistSessionIdentity } from '@/lib/sessionStorage';

interface CreateSessionFormProps {
  pbis: ProductBacklogItem[];
}

type FormStatus = { state: 'idle' } | { state: 'submitting' } | { state: 'error'; message: string };

export function CreateSessionForm({ pbis }: CreateSessionFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [facilitatorName, setFacilitatorName] = useState('');
  const [selectedPbiId, setSelectedPbiId] = useState<string>('');
  const [status, setStatus] = useState<FormStatus>({ state: 'idle' });

  const selectablePbis = useMemo(() => pbis, [pbis]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!facilitatorName.trim()) {
      setStatus({ state: 'error', message: 'ファシリテーター名を入力してください。' });
      return;
    }

    if (!title.trim()) {
      setStatus({ state: 'error', message: 'セッションタイトルを入力してください。' });
      return;
    }

    if (!selectedPbiId) {
      setStatus({ state: 'error', message: '対象 PBI を選択してください。' });
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
          pbiIds: [selectedPbiId],
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

      const data = (await response.json()) as { sessionId: string; joinToken: string };

      persistSessionIdentity(data.sessionId, {
        userId: facilitatorId,
        name: facilitatorName.trim(),
        joinToken: data.joinToken,
      });

      setTitle('');
      setFacilitatorName('');
      setSelectedPbiId('');
      setStatus({ state: 'idle' });

      const path = buildSessionEntryPath(data.sessionId, data.joinToken);
      router.push(path as any);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明なエラーが発生しました。';
      setStatus({ state: 'error', message });
    }
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
        対象 PBI
        <select
          className="form-input"
          value={selectedPbiId}
          onChange={(event) => setSelectedPbiId(event.target.value)}
          disabled={isSubmitting || selectablePbis.length === 0}
        >
          <option value="">PBI を選択...</option>
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

      {status.state === 'error' && <p className="feedback error">{status.message}</p>}
      {selectablePbis.length === 0 && (
        <p className="feedback warning">登録された PBI がありません。</p>
      )}
    </form>
  );
}
