import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Emergency Medical Data — MediCore',
  description: 'Emergency medical information for first responders and medical professionals.',
};

export default function EmergencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        minHeight: '100vh',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        color: '#111111',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {children}
    </div>
  );
}
