import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/mocks/pbis';
import { ensureDemoSession } from '@/server/session/seed';
import './globals.css';
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider';

void ensureDemoSession();

export const metadata: Metadata = {
  title: 'Fire Pocker',
  description: 'Lightweight planning poker companion for Notion-native teams.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="app-shell">
        <div className="app-container">
          <header className="app-header">
            <h1>Fire Pocker</h1>
            <p>
              Notion と連携したプランニングポーカー。セッションを選択してチームの見積もりを開始し
              ましょう。
            </p>
          </header>
          <ReactQueryProvider>
            <main className="app-main">{children}</main>
          </ReactQueryProvider>
          <footer className="app-footer">
            &copy; {new Date().getFullYear()} Fire Pocker Team — Internal prototype
          </footer>
        </div>
      </body>
    </html>
  );
}
