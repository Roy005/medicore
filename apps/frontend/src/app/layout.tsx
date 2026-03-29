import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MediCore — Precision Health Platform',
  description: 'Clinical-grade infrastructure for your personal health data. HIPAA compliant. Track vitals, manage medical records, and get AI-powered health insights.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <div className="min-h-screen text-foreground relative selection:bg-[#005454]/20 selection:text-[#005454]">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
