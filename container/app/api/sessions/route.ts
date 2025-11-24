import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSession } from '@/server/session/service';
import { toErrorResponse } from '@/server/http/error';

const bodySchema = z.object({
  title: z.string().min(1),
  facilitator: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
  pbiIds: z.array(z.string().min(1)).optional().default([]),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const body = bodySchema.parse(json);
    const response = await createSession(body);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
