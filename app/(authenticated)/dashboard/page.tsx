import { countSessions } from '@/server/session/store';
import { ensureDemoSession } from '@/server/session/seed';
import { DashboardContent } from './DashboardContent';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  await ensureDemoSession();
  const activeSessions = await countSessions();
  return <DashboardContent initialActiveSessions={activeSessions} />;
}
