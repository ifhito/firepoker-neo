import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listPbis } from '@/server/pbi/service';
import { toErrorResponse } from '@/server/http/error';

const querySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.parse({
      status: searchParams.get('status') ?? undefined,
      search: searchParams.get('search') ?? undefined,
    });
    const response = await listPbis(parsed);
    return NextResponse.json(response);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
