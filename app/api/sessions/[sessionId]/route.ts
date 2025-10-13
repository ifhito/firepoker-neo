import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionStateAuthorized } from '@/server/session/service';
import { HttpError, toErrorResponse } from '@/server/http/error';

// 動的ルートを完全にダイナミックにする
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  sessionId: z.string().min(1),
});

const extractJoinToken = (request: Request): string => {
  const header = request.headers.get('authorization');
  if (!header) {
    throw new HttpError(401, 'Unauthorized', 'Authorization header is required.');
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new HttpError(401, 'Unauthorized', 'Authorization header must be Bearer token.');
  }

  return match[1].trim();
};

export async function GET(request: Request, { params }: { params: { sessionId: string } }) {
  try {
    const { sessionId } = paramsSchema.parse(params);
    const joinToken = extractJoinToken(request);
    const state = await getSessionStateAuthorized(sessionId, joinToken);
    return NextResponse.json(state);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
