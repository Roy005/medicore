import fs from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';
import EmergencyClientActions from './EmergencyClientActions';

/* Performance: No external CSS/fonts loaded. All styles are inline.
 * Target: P99 < 8s on 3G (50Kbps, 300ms RTT).
 * Accessibility: Min 18px font, high contrast, works without JS. */

/* ─── Types ────────────────────────────────────────────────── */
interface EmergencySnapshot {
  patientName: string;
  bloodGroup: string | null;
  allergies: { allergen: string; severity: string; reaction: string | null }[];
  activeMedications: { drugName: string; dosage: string | null; frequency: string | null }[];
  chronicConditions: string[];
  emergencyContacts: { name?: string; phone?: string; relationship?: string }[];
  lastVitalsSnapshot: {
    bp: string | null;
    hr: string | null;
    spo2: string | null;
    glucose: string | null;
    recordedAt: string | null;
  };
  aiWarningFlags: string[];
  generatedAt: string;
  warningMessage: string;
}

/* ─── Helpers ──────────────────────────────────────────────── */
function readSnapshot(token: string): EmergencySnapshot | null {
  try {
    // Sanitize: token must be hex only
    if (!/^[a-f0-9]+$/i.test(token)) return null;

    const filePath = path.join(process.cwd(), 'public', 'emergency', `${token}.json`);
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as EmergencySnapshot;
  } catch {
    return null;
  }
}

function getTimeAgo(isoDate: string): string {
  const now = new Date();
  const then = new Date(isoDate);
  const diffMs = now.getTime() - then.getTime();

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

function isStale(isoDate: string): boolean {
  const then = new Date(isoDate);
  const now = new Date();
  return now.getTime() - then.getTime() > 24 * 60 * 60 * 1000;
}

function severityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'severe':
    case 'critical':
      return '#DC2626';
    case 'moderate':
      return '#EA580C';
    case 'mild':
      return '#CA8A04';
    default:
      return '#6B7280';
  }
}

function bloodGroupColor(group: string | null): string {
  if (!group) return '#6B7280';
  if (group.includes('-')) return '#2563EB';
  return '#DC2626';
}

/* ─── Page Component (Server) ──────────────────────────────── */
export const dynamic = 'force-dynamic'; // Always SSR, never cached

export default function EmergencyPage({
  params,
}: {
  params: { token: string };
}) {
  const snapshot = readSnapshot(params.token);
  if (!snapshot) return notFound();

  const stale = isStale(snapshot.generatedAt);
  const timeAgo = getTimeAgo(snapshot.generatedAt);
  const hasVitals =
    snapshot.lastVitalsSnapshot.bp ||
    snapshot.lastVitalsSnapshot.hr ||
    snapshot.lastVitalsSnapshot.spo2 ||
    snapshot.lastVitalsSnapshot.glucose;

  return (
    <main style={{ maxWidth: 600, margin: '0 auto', padding: '16px 20px 40px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#FFFFFF' }}>
      {/* ── Header ────────────────────────────────────────── */}
      <header
        style={{
          textAlign: 'center',
          borderBottom: '3px solid #DC2626',
          paddingBottom: 12,
          marginBottom: 8,
        }}
      >
        <h1
          style={{
            fontSize: 30,
            fontWeight: 800,
            color: '#B91C1C',
            margin: '0 0 4px',
            letterSpacing: '-0.5px',
          }}
        >
          🚨 EMERGENCY MEDICAL DATA
        </h1>
        <p style={{ fontSize: 22, color: '#111827', margin: 0, fontWeight: 700 }}>
          {snapshot.patientName}
        </p>
      </header>

      {/* ── Stale Warning Banner ──────────────────────────── */}
      {stale && (
        <div
          style={{
            background: 'rgba(254, 243, 199, 0.7)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #F59E0B',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 16,
            textAlign: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
          }}
        >
          <strong style={{ color: '#78350F', fontSize: 18, lineHeight: 1.4 }}>
            ⚠️ This data may be outdated
          </strong>
          <p style={{ color: '#78350F', fontSize: 18, margin: '6px 0 0', lineHeight: 1.4 }}>
            Last updated {timeAgo}. Contact the patient or their provider for current information.
          </p>
        </div>
      )}

      {/* ── Timestamp ─────────────────────────────────────── */}
      <p
        style={{
          fontSize: 18,
          color: '#4B5563',
          textAlign: 'center',
          margin: '0 0 16px',
        }}
      >
        Last updated: <strong>{timeAgo}</strong>
      </p>

      {/* ── 1. Blood Type ─────────────────────────────────── */}
      <section style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '16px 20px',
            background: snapshot.bloodGroup ? 'rgba(254, 242, 242, 0.7)' : 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${bloodGroupColor(snapshot.bloodGroup)}`,
            borderRadius: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
          }}
        >
          <span style={{ fontSize: 32 }}>🩸</span>
          <div style={{ textAlign: 'center' }}>
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: '#4B5563',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Blood Type
            </span>
            <div
              style={{
                fontSize: 36,
                fontWeight: 900,
                color: bloodGroupColor(snapshot.bloodGroup),
                lineHeight: 1.1,
              }}
            >
              {snapshot.bloodGroup || 'Unknown'}
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Allergies ──────────────────────────────────── */}
      <section style={{ marginBottom: 16 }}>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: '#DC2626',
            margin: '0 0 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ⚠️ ALLERGIES
        </h2>
        {snapshot.allergies.length === 0 ? (
          <p style={{ color: '#4B5563', fontSize: 18, margin: 0, padding: '8px 0' }}>
            No known allergies recorded.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {snapshot.allergies.map((a, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(254, 242, 242, 0.7)',
                  backdropFilter: 'blur(8px)',
                  border: `1px solid ${severityColor(a.severity)}`,
                  borderRadius: 12,
                  padding: '12px 16px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 20, color: '#111' }}>{a.allergen}</strong>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#FFF',
                      background: severityColor(a.severity),
                      padding: '4px 10px',
                      borderRadius: 999,
                      textTransform: 'uppercase',
                    }}
                  >
                    {a.severity}
                  </span>
                </div>
                {a.reaction && (
                  <p style={{ margin: '6px 0 0', fontSize: 18, color: '#7F1D1D' }}>
                    Reaction: {a.reaction}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 3. Active Medications ─────────────────────────── */}
      <section style={{ marginBottom: 16 }}>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: '#1D4ED8',
            margin: '0 0 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          💊 ACTIVE MEDICATIONS
        </h2>
        {snapshot.activeMedications.length === 0 ? (
          <p style={{ color: '#4B5563', fontSize: 18, margin: 0, padding: '8px 0' }}>
            No active medications recorded.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {snapshot.activeMedications.map((m, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(239, 246, 255, 0.6)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(191, 219, 254, 0.8)',
                  borderRadius: 12,
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
                }}
              >
                <strong style={{ fontSize: 20, color: '#111' }}>{m.drugName}</strong>
                <span style={{ fontSize: 18, color: '#1E40AF', fontWeight: 600 }}>
                  {[m.dosage, m.frequency].filter(Boolean).join(' · ') || '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 4. Chronic Conditions ─────────────────────────── */}
      <section style={{ marginBottom: 16 }}>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: '#7C3AED',
            margin: '0 0 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          🏥 CONDITIONS
        </h2>
        {snapshot.chronicConditions.length === 0 ? (
          <p style={{ color: '#4B5563', fontSize: 18, margin: 0, padding: '8px 0' }}>
            No chronic conditions recorded.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {snapshot.chronicConditions.map((c, i) => (
              <li key={i} style={{ fontSize: 20, color: '#111', marginBottom: 6, fontWeight: 500 }}>
                {c}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 5. Vitals Snapshot ────────────────────────────── */}
      {hasVitals && (
        <section style={{ marginBottom: 16 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: '#059669',
              margin: '0 0 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            📊 LAST VITALS
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8,
            }}
          >
            {[
              { label: 'Blood Pressure', value: snapshot.lastVitalsSnapshot.bp, unit: 'mmHg' },
              { label: 'Heart Rate', value: snapshot.lastVitalsSnapshot.hr, unit: 'bpm' },
              { label: 'SpO₂', value: snapshot.lastVitalsSnapshot.spo2, unit: '%' },
              { label: 'Glucose', value: snapshot.lastVitalsSnapshot.glucose, unit: 'mg/dL' },
            ]
              .filter((v) => v.value)
              .map((v, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(240, 253, 244, 0.6)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(187, 247, 208, 0.8)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    textAlign: 'center',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
                  }}
                >
                  <div style={{ fontSize: 16, color: '#4B5563', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{v.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#111', fontFamily: 'monospace' }}>
                    {v.value}
                    <span style={{ fontSize: 16, fontWeight: 500, color: '#4B5563' }}> {v.unit}</span>
                  </div>
                </div>
              ))}
          </div>
          {snapshot.lastVitalsSnapshot.recordedAt && (
            <p style={{ fontSize: 16, color: '#6B7280', margin: '6px 0 0', textAlign: 'right' }}>
              Vitals recorded: {new Date(snapshot.lastVitalsSnapshot.recordedAt).toLocaleString()}
            </p>
          )}
        </section>
      )}

      {/* ── 6. Emergency Contacts ─────────────────────────── */}
      <section style={{ marginBottom: 20 }}>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: '#0369A1',
            margin: '0 0 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          📞 EMERGENCY CONTACTS
        </h2>
        {snapshot.emergencyContacts.length === 0 ? (
          <p style={{ color: '#4B5563', fontSize: 18, margin: 0, padding: '8px 0' }}>
            No emergency contacts recorded.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {snapshot.emergencyContacts.map((c, i) => (
              <a
                key={i}
                href={c.phone ? `tel:${c.phone}` : undefined}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(239, 246, 255, 0.6)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(191, 219, 254, 0.8)',
                  borderRadius: 12,
                  padding: '12px 16px',
                  textDecoration: 'none',
                  color: 'inherit',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
                }}
              >
                <div>
                  <strong style={{ fontSize: 20, color: '#111' }}>{c.name || 'Contact'}</strong>
                  {c.relationship && (
                    <span style={{ fontSize: 18, color: '#4B5563', marginLeft: 8 }}>
                      ({c.relationship})
                    </span>
                  )}
                </div>
                {c.phone && (
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#FFF',
                      background: '#1D4ED8',
                      padding: '8px 18px',
                      borderRadius: 999,
                    }}
                  >
                    📞 Call
                  </span>
                )}
              </a>
            ))}
          </div>
        )}
      </section>

      {/* ── AI Warning Flags ──────────────────────────────── */}
      {snapshot.aiWarningFlags.length > 0 && (
        <section style={{ marginBottom: 16 }}>
          <div
            style={{
              background: 'rgba(254, 242, 242, 0.6)',
              backdropFilter: 'blur(8px)',
              border: '1px solid #DC2626',
              borderRadius: 12,
              padding: '16px 20px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
            }}
          >
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#B91C1C', margin: '0 0 8px' }}>
              🤖 AI WARNING FLAGS
            </h3>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {snapshot.aiWarningFlags.map((flag, i) => (
                <li key={i} style={{ fontSize: 18, color: '#7F1D1D', fontWeight: 600, marginBottom: 4 }}>
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Client Actions (Log button) ───────────────────── */}
      <EmergencyClientActions token={params.token} />

      {/* ── Noscript fallback: page is fully readable without JS ─── */}
      <noscript>
        <div style={{ textAlign: 'center', margin: '12px 0', fontSize: 18, color: '#4B5563' }}>
          JavaScript is disabled. All emergency data above is fully readable.
        </div>
      </noscript>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer
        style={{
          marginTop: 32,
          paddingTop: 16,
          borderTop: '1px solid #E5E7EB',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 20, fontWeight: 700, color: '#1D4ED8', margin: '0 0 4px' }}>
          MediCore
        </p>
        <p style={{ fontSize: 18, color: '#6B7280', margin: 0 }}>
          For medical professionals only. This is a static snapshot of patient data.
        </p>
        <p style={{ fontSize: 16, color: '#9CA3AF', margin: '8px 0 0' }}>
          © {new Date().getFullYear()} MediCore Health Systems
        </p>
      </footer>
    </main>
  );
}
