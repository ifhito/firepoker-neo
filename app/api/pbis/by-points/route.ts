import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listPbisByStoryPoints } from '@/server/pbi/service';
import { toErrorResponse } from '@/server/http/error';

const querySchema = z.object({
  points: z.string().min(1), // カンマ区切りのポイント (例: "2,3,5")
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pointsParam = searchParams.get('points');
    
    console.log('[API /api/pbis/by-points] Request received:', { pointsParam });
    
    if (!pointsParam) {
      return NextResponse.json(
        { error: 'points parameter is required' },
        { status: 400 }
      );
    }

    const { points } = querySchema.parse({ points: pointsParam });
    
    // カンマ区切りの文字列を数値配列に変換
    const pointValues = points
      .split(',')
      .map(p => p.trim())
      .filter(p => p)
      .map(p => parseInt(p, 10))
      .filter(p => !isNaN(p));

    console.log('[API /api/pbis/by-points] Parsed points:', pointValues);

    if (pointValues.length === 0) {
      return NextResponse.json(
        { error: 'No valid points provided' },
        { status: 400 }
      );
    }

    const response = await listPbisByStoryPoints(pointValues);
    console.log('[API /api/pbis/by-points] Found PBIs:', response.items.length);
    
    return NextResponse.json(response);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
