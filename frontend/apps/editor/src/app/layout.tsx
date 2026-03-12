import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { ErrorBoundary, Footer, Header } from '@snapmatch/shared';
import { Providers } from '@/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'SnapMatch Editor',
  description: 'Editor workspace for SnapMatch'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header app="editor" />
          <ErrorBoundary>
            <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
          </ErrorBoundary>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
