'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { nanoid } from 'nanoid';
import { buildSessionEntryPath, buildSessionJoinLink, persistSessionIdentity } from '@/lib/sessionStorage';
import { copyToClipboard } from '@/lib/clipboard';

export default function IntakePage() {
  const router = useRouter();
  const [title, setTitle] = useState('スプリント見積もり');
  const [hostName, setHostName] = useState('');
  const [dbId, setDbId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!hostName.trim()) {
      setError('名前を入力してください。');
      return;
    }

    setIsSubmitting(true);
    try {
      const facilitatorId = `host_${nanoid(8)}`;
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'fire-pocker-intake',
        },
        body: JSON.stringify({
          title: title.trim(),
          facilitator: {
            id: facilitatorId,
            name: hostName.trim(),
          },
          pbiIds: [],
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload?.message === 'string' ? payload.message : 'ROOM の作成に失敗しました。';
        throw new Error(message);
      }

      const data = (await response.json()) as { sessionId: string; joinToken: string };
      persistSessionIdentity(data.sessionId, {
        userId: facilitatorId,
        name: hostName.trim(),
        joinToken: data.joinToken,
        dbId: dbId.trim() || null,
      });

      const entryPath = buildSessionEntryPath(data.sessionId, data.joinToken);
      const shareUrl = buildSessionJoinLink(data.sessionId, data.joinToken, window.location.origin);
      
      // クリップボードにコピー（HTTP環境でも動作）
      copyToClipboard(shareUrl).catch(() => {
        /* clipboard may fail silently */
      });

      router.push(entryPath as Route);
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="card">
      <div className="badge">ROOM 作成</div>
      <h2>見積もりセッションを開始</h2>
      <p>ホストの名前と Notion DB ID を登録し、参加者に共有する URL を発行します。</p>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="form-label">
          セッションタイトル
          <input
            className="form-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isSubmitting}
          />
        </label>
        <label className="form-label">
          あなたの名前
          <input
            className="form-input"
            value={hostName}
            onChange={(event) => setHostName(event.target.value)}
            disabled={isSubmitting}
            placeholder="例: 山田 太郎"
          />
        </label>
        <label className="form-label">
          Notion PBI Database ID
          <input
            className="form-input"
            value={dbId}
            onChange={(event) => setDbId(event.target.value)}
            disabled={isSubmitting}
            placeholder="設定済みの場合は空でも可"
          />
        </label>
        <small className="form-help">
          現状の実装では環境変数の DB ID が優先されます。将来的にセッション単位で切り替え予定です。
        </small>
        <button className="button-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'ROOM 作成中...' : 'ROOM を作成'}
        </button>
      </form>

      {error && <p className="feedback error">{error}</p>}
    </section>
  );
}
