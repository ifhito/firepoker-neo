/**
 * クリップボードにテキストをコピーする（HTTP環境対応）
 * 
 * HTTPSの場合は navigator.clipboard.writeText() を使用
 * HTTPの場合は document.execCommand('copy') にフォールバック
 */
export async function copyToClipboard(text: string): Promise<void> {
  // Modern Clipboard API (HTTPS required)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (err) {
      console.warn('Clipboard API failed, falling back to execCommand', err);
      // Fall through to legacy method
    }
  }

  // Legacy method (works on HTTP)
  return fallbackCopyToClipboard(text);
}

/**
 * レガシーメソッドでクリップボードにコピー（HTTP環境用）
 */
function fallbackCopyToClipboard(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 一時的なtextareaを作成
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // 画面外に配置（ユーザーには見えない）
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        resolve();
      } else {
        reject(new Error('execCommand("copy") failed'));
      }
    } catch (err) {
      document.body.removeChild(textArea);
      reject(err);
    }
  });
}
