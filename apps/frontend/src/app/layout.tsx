import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MediCore Frontend',
  description: 'MediCore Glassmorphism Frontend',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <div className="min-h-screen text-foreground relative selection:bg-primary selection:text-primary-foreground">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
