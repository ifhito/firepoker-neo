import './globals.css';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Fire Pocker Serverless',
  description: 'Planning poker powered by API Gateway WebSocket and Lambda',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
