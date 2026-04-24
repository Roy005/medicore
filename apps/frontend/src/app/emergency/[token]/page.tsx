import { notFound } from 'next/navigation';
import EmergencyClientActions from './EmergencyClientActions';

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
function getTimeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function isStale(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > 86400000;
}

function hashSnapshot(s: EmergencySnapshot): string {
  let h = 0;
  const str = JSON.stringify(s);
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return Math.abs(h).toString(16).padStart(8, '0').toUpperCase();
}

/* ─── Data Fetching ────────────────────────────────────────── */
async function fetchSnapshot(token: string): Promise<EmergencySnapshot | null> {
  try {
    if (!/^[a-f0-9]+$/i.test(token)) return null;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3001/api/v1';
    const base = apiBase.endsWith('/api/v1') ? apiBase : `${apiBase}/api/v1`;
    const res = await fetch(`${base}/emergency/${token}/data`, { cache: 'no-store', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as EmergencySnapshot;
  } catch { return null; }
}

/* ─── Design Tokens (matching MediCore dashboard) ──────────── */
const T = {
  bg: '#f8fafb',
  card: '#ffffff',
  cardShadow: '0px 12px 32px rgba(25, 28, 29, 0.04)',
  teal: '#005454',
  tealContainer: '#0d6e6e',
  text: '#191c1d',
  textSecondary: '#3e4948',
  textMuted: '#6e7979',
  textFaint: '#bec9c8',
  border: 'rgba(190, 201, 200, 0.25)',
  error: '#ba1a1a',
  errorBg: '#ffdad6',
  coral: '#E8533A',
  sageGreen: '#4CAF82',
  surfaceLow: '#f2f4f5',
  surfaceHigh: '#e6e8e9',
};

/* ─── Page ─────────────────────────────────────────────────── */
export const dynamic = 'force-dynamic';

export default async function EmergencyPage({ params }: { params: { token: string } }) {
  const s = await fetchSnapshot(params.token);
  if (!s) return notFound();

  const stale = isStale(s.generatedAt);
  const timeAgo = getTimeAgo(s.generatedAt);
  const hash = hashSnapshot(s);
  const hasVitals = s.lastVitalsSnapshot.bp || s.lastVitalsSnapshot.hr || s.lastVitalsSnapshot.spo2 || s.lastVitalsSnapshot.glucose;

  const card: React.CSSProperties = {
    background: T.card,
    borderRadius: 12,
    boxShadow: T.cardShadow,
  };
  const mono: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    color: T.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <main style={{ fontFamily: "'Inter', -apple-system, sans-serif", minHeight: '100vh', background: T.bg }}>

        {/* ═══ HEADER — Teal gradient matching MediCore brand ═══ */}
        <header style={{
          background: `linear-gradient(135deg, ${T.teal} 0%, ${T.tealContainer} 100%)`,
          padding: '24px 0 28px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.02) 10px, rgba(255,255,255,0.02) 20px)' }} />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>M</span>
                </div>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>MediCore</span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 500, marginLeft: 4 }}>Emergency Portal</span>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>HIPAA Compliant</span>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: 'rgba(132,212,211,0.7)', textTransform: 'uppercase' }}>● AES-256</span>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                background: T.error, color: '#fff',
                padding: '8px 24px', borderRadius: 6,
                fontSize: 13, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase',
              }}>
                ⚠ CRITICAL MEDICAL ALERT
              </div>
              <p style={{ color: 'rgba(132,212,211,0.6)', fontSize: 12, marginTop: 8, fontWeight: 500 }}>
                Active Medical Record • For Authorized Medical Personnel
              </p>
            </div>
          </div>
        </header>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 48px' }}>

          {/* ═══ STALE WARNING ════════════════════════════════════ */}
          {stale && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '14px 20px', marginTop: 20, textAlign: 'center' }}>
              <strong style={{ color: '#78350F', fontSize: 14 }}>⚠ Data may be outdated</strong>
              <p style={{ color: '#92400E', fontSize: 13, marginTop: 4 }}>Last synchronized {timeAgo}.</p>
            </div>
          )}

          {/* ═══ PATIENT IDENTITY ═════════════════════════════════ */}
          <section style={{ ...card, padding: '28px 32px', marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${T.teal}, ${T.tealContainer})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>{s.patientName[0]?.toUpperCase()}</span>
                </div>
                <div>
                  <h1 style={{ fontSize: 28, fontWeight: 800, color: T.text, letterSpacing: -0.5, lineHeight: 1.1 }}>{s.patientName}</h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.sageGreen, display: 'inline-block' }}></span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.sageGreen, textTransform: 'uppercase', letterSpacing: 1 }}>Active Medical Record</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
                {[
                  { label: 'Record', value: 'MediCore Patient' },
                  { label: 'Last Sync', value: timeAgo },
                  { label: 'Language', value: 'English' },
                ].map((m, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 }}>{m.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.textSecondary, marginTop: 2, ...mono }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
            {s.bloodGroup && (
              <div style={{ textAlign: 'center', background: T.surfaceLow, borderRadius: 12, padding: '16px 28px', minWidth: 120 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 }}>Blood Group</div>
                <div style={{ fontSize: 40, fontWeight: 900, color: T.error, lineHeight: 1.1, marginTop: 4, ...mono }}>{s.bloodGroup}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, fontWeight: 500 }}>Core Serology</div>
              </div>
            )}
          </section>

          {/* ═══ THREE-COLUMN CLINICAL GRID ═══════════════════════ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>

            {/* Allergies */}
            <section style={{ ...card, padding: '24px 28px' }}>
              <h2 style={{ ...sectionTitle, color: T.error }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(186,26,26,0.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⚠️</span>
                Allergies
              </h2>
              {s.allergies.length === 0 ? (
                <p style={{ color: T.textMuted, fontSize: 14 }}>No known allergies.</p>
              ) : (
                s.allergies.map((a, i) => (
                  <div key={i} style={{ padding: '12px 0', borderBottom: i < s.allergies.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{a.allergen}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.error, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{a.severity}{a.reaction ? ` — ${a.reaction}` : ''}</div>
                  </div>
                ))
              )}
            </section>

            {/* Medications */}
            <section style={{ ...card, padding: '24px 28px' }}>
              <h2 style={{ ...sectionTitle, color: T.teal }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,84,84,0.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>💊</span>
                Medications
              </h2>
              {s.activeMedications.length === 0 ? (
                <p style={{ color: T.textMuted, fontSize: 14 }}>No active medications.</p>
              ) : (
                s.activeMedications.map((m, i) => (
                  <div key={i} style={{ padding: '12px 0', borderBottom: i < s.activeMedications.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                    <div><span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{m.drugName}</span>
                      {m.dosage && <span style={{ fontSize: 13, fontWeight: 700, color: T.teal, marginLeft: 8, ...mono }}>{m.dosage}</span>}
                    </div>
                    {m.frequency && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{m.frequency}</div>}
                  </div>
                ))
              )}
            </section>

            {/* Diagnostics */}
            <section style={{ ...card, padding: '24px 28px' }}>
              <h2 style={{ ...sectionTitle, color: '#4c5f7e' }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(76,95,126,0.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📋</span>
                Diagnostic History
              </h2>
              {s.chronicConditions.length === 0 ? (
                <p style={{ color: T.textMuted, fontSize: 14 }}>No chronic conditions.</p>
              ) : (
                s.chronicConditions.map((c, i) => (
                  <div key={i} style={{ padding: '12px 0', borderBottom: i < s.chronicConditions.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{c}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Chronic / Persistent</div>
                  </div>
                ))
              )}
            </section>
          </div>

          {/* ═══ BIOMETRICS GRID ══════════════════════════════════ */}
          {hasVitals && (
            <section style={{ ...card, padding: '24px 28px', marginTop: 16 }}>
              <h2 style={sectionTitle}>
                <span style={{ fontSize: 14 }}>📊</span>
                Latest Biometrics
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { label: 'Heart Rate', value: s.lastVitalsSnapshot.hr, unit: 'BPM', color: T.coral },
                  { label: 'Blood Pressure', value: s.lastVitalsSnapshot.bp, unit: 'mmHg', color: T.teal },
                  { label: 'Oxygen Sat (SpO₂)', value: s.lastVitalsSnapshot.spo2, unit: '%', color: '#4c5f7e' },
                  { label: 'Blood Glucose', value: s.lastVitalsSnapshot.glucose, unit: 'mg/dL', color: T.sageGreen },
                ].filter(v => v.value).map((v, i) => (
                  <div key={i} style={{ background: T.surfaceLow, borderRadius: 10, padding: '20px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>{v.label}</div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: v.color, lineHeight: 1, ...mono }}>{v.value}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, marginTop: 6 }}>{v.unit}</div>
                  </div>
                ))}
              </div>
              {s.lastVitalsSnapshot.recordedAt && (
                <p style={{ fontSize: 11, color: T.textFaint, marginTop: 12, textAlign: 'right', ...mono }}>
                  Recorded: {new Date(s.lastVitalsSnapshot.recordedAt).toLocaleString()}
                </p>
              )}
            </section>
          )}

          {/* ═══ AI FLAGS ═════════════════════════════════════════ */}
          {s.aiWarningFlags.length > 0 && (
            <section style={{ ...card, padding: '24px 28px', marginTop: 16, borderLeft: `4px solid ${T.error}` }}>
              <h2 style={{ ...sectionTitle, color: T.error }}>
                <span style={{ fontSize: 14 }}>🤖</span>
                AI Clinical Flags
              </h2>
              {s.aiWarningFlags.map((f, i) => (
                <div key={i} style={{ background: T.errorBg, borderRadius: 8, padding: '10px 16px', marginBottom: 8, fontSize: 14, fontWeight: 600, color: T.error }}>{f}</div>
              ))}
            </section>
          )}

          {/* ═══ EMERGENCY CONTACTS ══════════════════════════════ */}
          <section style={{ ...card, padding: '24px 28px', marginTop: 16 }}>
            <h2 style={sectionTitle}>
              <span style={{ fontSize: 14 }}>📞</span>
              Emergency Contacts
            </h2>
            {s.emergencyContacts.length === 0 ? (
              <p style={{ color: T.textMuted, fontSize: 14 }}>No emergency contacts recorded.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {s.emergencyContacts.map((c, i) => (
                  <div key={i} style={{ background: T.surfaceLow, borderRadius: 10, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
                        {i === 0 ? 'Primary Kin / Proxy' : 'Emergency Contact'}
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{c.name || 'Contact'}</div>
                      {c.relationship && <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>Relation: {c.relationship}</div>}
                    </div>
                    {c.phone && (
                      <a href={`tel:${c.phone}`} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: `linear-gradient(135deg, ${T.teal}, ${T.tealContainer})`, color: '#fff',
                        fontSize: 13, fontWeight: 700, padding: '10px 20px', borderRadius: 10,
                        textDecoration: 'none', boxShadow: '0 2px 8px rgba(0,84,84,0.2)',
                      }}>
                        📞 Call
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ═══ CLIENT ACTIONS ═══════════════════════════════════ */}
          <EmergencyClientActions token={params.token} />

          {/* ═══ FOOTER ══════════════════════════════════════════ */}
          <footer style={{ ...card, padding: '24px 28px', marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>Record Authenticity</div>
                <div style={{ fontSize: 12, color: T.textFaint, ...mono }}>SHA-256 Hash: {hash}</div>
                <div style={{ fontSize: 12, color: T.textFaint, marginTop: 2, ...mono }}>Last Sync: {new Date(s.generatedAt).toISOString().replace('T', ' ').substring(0, 19)} UTC</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${T.teal}, ${T.tealContainer})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: 12 }}>M</span>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: T.teal, letterSpacing: -0.3 }}>MediCore</span>
                </div>
                <div style={{ fontSize: 11, color: T.textFaint, marginTop: 4 }}>Precision Sanctuary Core v4.2</div>
              </div>
            </div>
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${T.border}`, textAlign: 'center' }}>
              <span style={{ fontSize: 10, color: T.textFaint, letterSpacing: 1 }}>Clinical Compliance: HL7 FHIR / HIPAA · © {new Date().getFullYear()} MediCore Health Systems</span>
            </div>
          </footer>
        </div>
      </main>
    </>
  );
}
