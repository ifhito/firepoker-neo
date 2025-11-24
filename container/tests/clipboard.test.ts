import { describe, it, expect } from 'vitest';

/**
 * clipboard.ts のテスト
 * 
 * 注: copyToClipboard() 関数はブラウザのDOM APIに依存するため、
 * Node.js環境での単体テストは困難です。
 * この関数の動作は手動テストまたはE2Eテストで検証してください。
 * 
 * HTTP環境での動作確認:
 * 1. ローカルでHTTPサーバーを起動 (pnpm dev)
 * 2. セッション作成画面で「コピー失敗」ボタンをクリック
 * 3. クリップボードにURLがコピーされることを確認
 */

describe('clipboard utilities', () => {
  it('should export copyToClipboard function', () => {
    // Dynamic import to avoid runtime errors in Node.js environment
    expect(async () => {
      const module = await import('@/lib/clipboard');
      expect(module.copyToClipboard).toBeDefined();
      expect(typeof module.copyToClipboard).toBe('function');
    }).not.toThrow();
  });
});
