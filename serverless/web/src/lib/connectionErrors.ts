const messages: Record<string, string> = {
  MISSING_TOKEN: 'sessionId と joinToken を指定してください。',
  INVALID_TOKEN: 'joinToken が無効か、期限切れです。セッションを再生成してください。',
  LIMIT_REACHED: '同時接続上限に達しました。既存参加者の退出後に再接続してください。',
};

export const describeConnectionError = (code?: string): string => {
  if (code && messages[code]) {
    return messages[code];
  }
  return '接続エラーが発生しました。joinToken や WebSocket エンドポイントを確認してください。';
};
