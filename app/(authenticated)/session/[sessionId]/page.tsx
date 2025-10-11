import { notFound } from 'next/navigation';
import { getSessionState } from '@/server/session/service';
import { listSimilarPbis, findPbi } from '@/server/pbi/service';
import { ensureDemoSession } from '@/server/session/seed';
import { getSessionJoinToken } from '@/server/session/store';
import SessionDetailClient from './SessionDetailClient';

interface SessionPageProps {
  params: { sessionId: string };
  searchParams: { token?: string };
}

export default async function SessionPage({ params, searchParams }: SessionPageProps) {
  try {
    await ensureDemoSession();
    const state = await getSessionState(params.sessionId);
    const joinToken = await getSessionJoinToken(params.sessionId);

    const pbiDetails = await Promise.all(state.meta.pbiIds.map((id) => findPbi(id)));
    const sessionPbis = pbiDetails.filter((item): item is NonNullable<typeof item> => Boolean(item));

    let activePbi = sessionPbis.find((item) => item.id === state.activePbiId) ?? null;
    if (!activePbi && state.activePbiId) {
      activePbi = await findPbi(state.activePbiId);
    }

    const similar = activePbi ? await listSimilarPbis(activePbi.id) : { items: [] };
    const token = searchParams.token ?? joinToken ?? null;
    return (
      <SessionDetailClient
        sessionId={params.sessionId}
        joinToken={token}
        initialState={state}
        pbis={sessionPbis}
        activePbi={activePbi}
        similar={similar.items}
      />
    );
  } catch (error) {
    console.error(error);
    notFound();
  }
}
