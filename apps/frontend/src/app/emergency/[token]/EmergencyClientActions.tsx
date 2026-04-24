'use client';

import { useState, useEffect } from 'react';

interface Props {
  token: string;
}

export default function EmergencyClientActions({ token }: Props) {
  const [logged, setLogged] = useState(false);
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    const logAccess = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const base = apiBase.endsWith('/api/v1') ? apiBase : `${apiBase}/api/v1`;
        await fetch(`${base}/emergency/${token}/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAgent: navigator.userAgent }),
        });
      } catch {
        // Swallow — never block emergency page
      }
    };
    logAccess();
  }, [token]);

  const handleLogAccess = async () => {
    if (logged || logging) return;
    setLogging(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const base = apiBase.endsWith('/api/v1') ? apiBase : `${apiBase}/api/v1`;
      await fetch(`${base}/emergency/${token}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAgent: navigator.userAgent }),
      });
      setLogged(true);
    } catch {
      setLogged(true);
    } finally {
      setLogging(false);
    }
  };

  return (
    <div style={{
      textAlign: 'center',
      padding: '20px 0',
      marginTop: 16,
    }}>
      <button
        onClick={handleLogAccess}
        disabled={logged || logging}
        style={{
          background: logged
            ? '#e6e8e9'
            : 'linear-gradient(135deg, #005454 0%, #0d6e6e 100%)',
          color: logged ? '#6e7979' : '#ffffff',
          border: 'none',
          borderRadius: 10,
          padding: '12px 32px',
          fontSize: 13,
          fontWeight: 700,
          cursor: logged ? 'default' : 'pointer',
          opacity: logging ? 0.7 : 1,
          transition: 'all 0.2s ease',
          letterSpacing: '0.5px',
          fontFamily: "'Inter', sans-serif",
          boxShadow: logged ? 'none' : '0 2px 8px rgba(0,84,84,0.2)',
        }}
      >
        {logging ? 'Logging...' : logged ? '✓ Access Logged' : '📋 Log This Access'}
      </button>
      <p style={{
        fontSize: 11,
        color: '#bec9c8',
        marginTop: 8,
        fontWeight: 500,
      }}>
        Records that this emergency data was accessed (patient will be notified).
      </p>
    </div>
  );
}
