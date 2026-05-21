import type { Metadata } from 'next';
import { Inter_Tight, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';

const interTight = Inter_Tight({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-display',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Экспертизы ДКП',
  description: 'Платформа управления экспертизами качества отделки квартир',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`h-full ${interTight.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-full font-sans antialiased">
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
