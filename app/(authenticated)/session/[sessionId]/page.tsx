import { randomUUID } from 'crypto';
import { notFound } from 'next/navigation';
import { getSessionState } from '@/server/session/service';
import { listSimilarPbis, findPbi } from '@/server/pbi/service';
import { ensureDemoSession } from '@/server/session/seed';

interface SessionPageProps {
  params: { sessionId: string };
}

export default async function SessionPage({ params }: SessionPageProps) {
  try {
    ensureDemoSession();
    const state = getSessionState(params.sessionId);
    const activePbi = state.activePbiId ? await findPbi(state.activePbiId) : null;
    const similar = activePbi ? await listSimilarPbis(activePbi.id) : { items: [] };

    return (
      <div className="card-grid">
        <section className="card">
          <div className="badge">セッション</div>
          <h2>{state.meta.title}</h2>
          <p>進行状況: {state.phase}</p>
          <p>ファシリテーター: {state.participants[0]?.displayName}</p>
          <p>
            対象 PBI 数: <strong>{state.meta.pbiIds.length}</strong>
          </p>
          <p>
            アクティブ PBI:{' '}
            {activePbi ? (
              <a className="badge" href={activePbi.notionUrl ?? '#'} target="_blank" rel="noreferrer">
                {activePbi.title}
              </a>
            ) : (
              '未選択'
            )}
          </p>
          <div>
            <h3>参加者</h3>
            <ul>
              {state.participants.map((participant) => (
                <li key={participant.userId}>
                  {participant.displayName} — 参加: {new Date(participant.joinedAt).toLocaleString('ja-JP')}
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="card">
          <div className="badge">類似 PBI</div>
          <h2>過去に同じポイントだった PBI</h2>
          {similar.items.length === 0 ? (
            <p>同じストーリーポイントの完了済み PBI はまだありません。</p>
          ) : (
            <ul>
              {similar.items.map((item) => (
                <li key={item.id}>
                  <a href={item.notionUrl ?? '#'} target="_blank" rel="noreferrer">
                    {item.title}
                  </a>{' '}
                  — {item.storyPoint}pt
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  } catch (error) {
    console.error(error);
    notFound();
  }
}
