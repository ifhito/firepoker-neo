import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listSimilarPbis } from '@/server/pbi/service';
import { toErrorResponse } from '@/server/http/error';

const paramsSchema = z.object({
  id: z.string().min(1),
});

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = paramsSchema.parse(params);
    const response = await listSimilarPbis(id);
    return NextResponse.json(response);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
