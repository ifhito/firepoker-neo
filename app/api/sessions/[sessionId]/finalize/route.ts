import { NextResponse } from 'next/server';
import { z } from 'zod';
import { finalizeSession } from '@/server/session/service';
import { toErrorResponse } from '@/server/http/error';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  sessionId: z.string().min(1),
});

const bodySchema = z.object({
  finalPoint: z.number().int(),
  memo: z.string().max(500).nullable().optional(),
});

export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  try {
    const { sessionId } = paramsSchema.parse(params);
    const json = await request.json();
    const body = bodySchema.parse(json);
    const response = await finalizeSession(sessionId, body);
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
