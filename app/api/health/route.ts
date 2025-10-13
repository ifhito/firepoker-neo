import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // シンプルなヘルスチェック - 常に200を返す
  // アプリケーションが起動していれば健全と判断
  return NextResponse.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'firepoker',
  });
}
