'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { persistSessionIdentity } from '@container/lib/sessionStorage';
import { resolveRestEndpoint } from '../../../src/config/websocket';
import { createSessionCreationStore, type SessionCreationState } from '../../../src/sessionCreation/store';

const fieldClass = 'form-input';

export default function SessionCreationPage() {
  const store = useMemo(
    () =>
      createSessionCreationStore({
        endpoint: resolveRestEndpoint(),
        fetch,
        persistIdentity: persistSessionIdentity,
      }),
    [],
  );
  const [state, setState] = useState<SessionCreationState>(store.getState());

  useEffect(() => store.subscribe(setState), [store]);

  const handleInput = (field: Parameters<typeof store.updateField>[0]) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      store.updateField(field as never, value as never);
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await store.submit();
  };

  return (
    <main className="creation-page">
      <header className="page-header">
        <div>
          <h1>セッションを作成</h1>
          <p>Notion バックログとファシリテーター情報を登録し、参加リンクを配布します。</p>
        </div>
        <Link className="link" href="/">
          ダッシュボードに戻る
        </Link>
      </header>

      <section className="card">
        <form onSubmit={handleSubmit} className="form-grid">
          <label className="form-label">
            セッションタイトル
            <input className={fieldClass} value={state.title} onChange={handleInput('title')} disabled={state.status === 'submitting'} />
            {state.errors.title && <span className="form-error">{state.errors.title}</span>}
          </label>

          <label className="form-label">
            ファシリテーター名
            <input className={fieldClass} value={state.facilitatorName} onChange={handleInput('facilitatorName')} disabled={state.status === 'submitting'} />
            {state.errors.facilitatorName && <span className="form-error">{state.errors.facilitatorName}</span>}
          </label>

          <label className="form-label">
            Notion PBI Database ID
            <input className={fieldClass} value={state.notionDbId} onChange={handleInput('notionDbId')} disabled={state.status === 'submitting'} placeholder="任意" />
          </label>

          <label className="form-label">
            接続上限
            <input
              className={fieldClass}
              type="number"
              min={1}
              value={state.connectionCap}
              onChange={handleInput('connectionCap')}
              disabled={state.status === 'submitting'}
            />
            {state.errors.connectionCap && <span className="form-error">{state.errors.connectionCap}</span>}
          </label>

          <label className="form-label checkbox">
            <input type="checkbox" checked={state.publicView} onChange={handleInput('publicView')} disabled={state.status === 'submitting'} /> 公開ビューを許可
          </label>

          <button className="button-primary" type="submit" disabled={state.status === 'submitting'}>
            {state.status === 'submitting' ? '作成中…' : 'セッションを作成'}
          </button>
        </form>
        {state.errors.global && <p className="feedback error">{state.errors.global}</p>}
        {state.status === 'success' && state.result && (
          <div className="feedback success">
            <p>
              sessionId: <strong>{state.result.sessionId}</strong>
            </p>
            <p>
              joinToken: <strong>{state.result.joinToken}</strong>
            </p>
            <p>参加者に上記の joinToken を共有し、リンク先で接続してください。</p>
          </div>
        )}
      </section>
    </main>
  );
}
