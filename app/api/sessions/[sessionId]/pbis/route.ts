import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateSessionPbis } from '@/server/session/service';
import { HttpError, toErrorResponse } from '@/server/http/error';

const paramsSchema = z.object({
  sessionId: z.string().min(1),
});

const bodySchema = z.object({
  action: z.enum(['add', 'remove']),
  pbiId: z.string().min(1),
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

export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  try {
    const { sessionId } = paramsSchema.parse(params);
    const joinToken = extractJoinToken(request);
    const json = await request.json();
    const { action, pbiId } = bodySchema.parse(json);

    const result = await updateSessionPbis(sessionId, joinToken, action, pbiId);

    return NextResponse.json(result);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
