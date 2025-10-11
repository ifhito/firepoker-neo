'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { nanoid } from 'nanoid';

interface JoinPageProps {
  params: { sessionId: string };
}

const STORAGE_KEY_PREFIX = 'firepocker-session-';

export default function JoinSessionPage({ params }: JoinPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const token = searchParams.get('token');

  if (!token) {
    return (
      <section className="card">
        <div className="feedback error">招待 URL に `token` が含まれていません。</div>
      </section>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('名前を入力してください。');
      return;
    }

    const userId = `user_${nanoid(10)}`;
    const sessionKey = `${STORAGE_KEY_PREFIX}${params.sessionId}`;
    const displayName = name.trim();

    window.sessionStorage.setItem(
      sessionKey,
      JSON.stringify({
        userId,
        name: displayName,
        joinToken: token,
      }),
    );

    try {
      const response = await fetch(`/api/sessions/${params.sessionId}/participants`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          displayName,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          typeof payload?.message === 'string' ? payload.message : 'ROOM への参加に失敗しました。';
        throw new Error(message);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'ROOM への参加に失敗しました。');
      return;
    }

    router.push(`/session/${params.sessionId}?token=${encodeURIComponent(token)}`);
  };

  return (
    <section className="card">
      <div className="badge">ROOM へ参加</div>
      <h2>参加者情報を入力</h2>
      <p>招待された ROOM に入るには、表示名を入力してください。</p>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="form-label">
          表示名
          <input
            className="form-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例: 佐藤 花子"
          />
        </label>
        <button className="button-primary" type="submit">
          参加する
        </button>
      </form>
      {error && <p className="feedback error">{error}</p>}
    </section>
  );
}
