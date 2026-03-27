import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

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
    <html lang="ru" className="h-full">
      <body className={`${inter.className} min-h-full`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
