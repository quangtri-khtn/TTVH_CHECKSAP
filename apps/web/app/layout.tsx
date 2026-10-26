import type { Metadata } from 'next';
import './globals.css';
import { Inter, JetBrains_Mono, Lexend } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin', 'vietnamese'], variable: '--font-sans' });
const lexend = Lexend({ subsets: ['latin', 'vietnamese'], variable: '--font-display' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin', 'vietnamese'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Thịnh Thế Vinh Hoa — SAP Monitor',
  description: 'Hệ thống giám sát & đối soát chuỗi chứng từ SAP HANA theo thời gian thực',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={cn('font-sans', inter.variable, lexend.variable, jetbrainsMono.variable)}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
