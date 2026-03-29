'use client';

import { useState } from 'react';

interface Props {
  token: string;
}

export default function EmergencyClientActions({ token }: Props) {
  const [logged, setLogged] = useState(false);
  const [logging, setLogging] = useState(false);

  const handleLogAccess = async () => {
    if (logged || logging) return;
    setLogging(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      await fetch(`${apiBase}/emergency/${token}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAgent: navigator.userAgent,
        }),
      });
      setLogged(true);
    } catch {
      // Swallow — never block emergency page
      setLogged(true);
    } finally {
      setLogging(false);
    }
  };

  return (
    <div style={{ textAlign: 'center', margin: '20px 0' }}>
      <button
        onClick={handleLogAccess}
        disabled={logged || logging}
        style={{
          background: logged ? '#D1D5DB' : '#1D4ED8',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 8,
          padding: '14px 32px',
          fontSize: 18,
          fontWeight: 700,
          cursor: logged ? 'default' : 'pointer',
          opacity: logging ? 0.7 : 1,
          transition: 'background 0.2s',
        }}
      >
        {logging ? 'Logging...' : logged ? '✓ Access Logged' : '📋 Log This Access'}
      </button>
      <p style={{ fontSize: 16, color: '#6B7280', marginTop: 8 }}>
        Logs that this emergency data was viewed (for patient notification).
      </p>
    </div>
  );
}
