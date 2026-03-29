/**
 * MediCore E2E Integration Test Suite
 * ────────────────────────────────────
 * Tests all 7 critical user journeys against a running backend.
 * Requires: docker-compose (postgres + redis) + backend running on :3001
 *
 * Usage: npx ts-node --project tsconfig.json test/e2e-integration.ts
 */

import axios, { AxiosInstance } from 'axios';

const BASE = 'http://localhost:3001/api/v1';

// ── Helpers ───────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 8);
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
    failures.push(label);
  }
}

async function runTest(name: string, fn: () => Promise<void>) {
  console.log(`\n━━━ ${name} ━━━`);
  try {
    await fn();
  } catch (err: any) {
    console.log(`  ❌ CRASHED: ${err.message}`);
    failed++;
    failures.push(`${name} (CRASH: ${err.message})`);
  }
}

function api(token?: string): AxiosInstance {
  return axios.create({
    baseURL: BASE,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    validateStatus: () => true, // never throw on HTTP status
  });
}

// ── State shared across tests ─────────────────────────────────

let patientToken = '';
let patientUserId = '';
let patientProfileId = '';
let doctorToken = '';
let doctorUserId = '';
let clinicalToken = '';

// ══════════════════════════════════════════════════════════════
// Journey 1: Patient Registration + Auth
// ══════════════════════════════════════════════════════════════

async function journey1_patientAuth() {
  const email = `patient-${uid()}@test.com`;

  // Register
  const reg = await api().post('/auth/register', {
    email,
    password: 'Test1234!',
    firstName: 'Test',
    lastName: 'Patient',
  });
  assert(reg.status === 201 || reg.status === 200, `Register patient → ${reg.status}`);
  assert(!!reg.data.accessToken, 'Received accessToken');

  patientToken = reg.data.accessToken;
  patientUserId = reg.data.user?.id || reg.data.userId || '';

  // /auth/me
  const me = await api(patientToken).get('/auth/me');
  assert(me.status === 200, `/auth/me → 200`);
  assert(me.data.email === email, `Email matches: ${me.data.email}`);
  patientUserId = me.data.id || patientUserId;

  // Login
  const login = await api().post('/auth/login', { email, password: 'Test1234!' });
  assert(login.status === 200 || login.status === 201, `Login → ${login.status}`);

  // Logout
  const logout = await api(patientToken).post('/auth/logout', {
    refreshToken: reg.data.refreshToken || login.data.refreshToken,
  });
  assert(logout.status === 200 || logout.status === 201, `Logout → ${logout.status}`);

  // Re-login for subsequent tests
  const relogin = await api().post('/auth/login', { email, password: 'Test1234!' });
  patientToken = relogin.data.accessToken;
}

// ══════════════════════════════════════════════════════════════
// Journey 2: Patient Profile CRUD
// ══════════════════════════════════════════════════════════════

async function journey2_patientProfile() {
  // GET profile
  const get = await api(patientToken).get(`/patients/${patientUserId}/profile`);
  assert(get.status === 200, `GET profile → ${get.status}`);
  patientProfileId = get.data.id || patientUserId;

  // PATCH profile
  const patch = await api(patientToken).patch(`/patients/${patientUserId}/profile`, {
    bloodType: 'O+',
    dateOfBirth: '1990-05-15',
  });
  assert(patch.status === 200, `PATCH profile → ${patch.status}`);
}

// ══════════════════════════════════════════════════════════════
// Journey 3: Doctor Registration + Consent Flow
// ══════════════════════════════════════════════════════════════

async function journey3_doctorConsent() {
  const docEmail = `doc-${uid()}@test.com`;

  // Register doctor
  const reg = await api().post('/auth/register/doctor', {
    email: docEmail,
    password: 'Doc1234!',
    firstName: 'Dr',
    lastName: 'Tester',
    specialization: 'General Medicine',
    licenseNumber: `LIC-${uid()}`,
  });
  assert(reg.status === 201 || reg.status === 200, `Register doctor → ${reg.status}`);
  doctorToken = reg.data.accessToken;

  const docMe = await api(doctorToken).get('/auth/me');
  doctorUserId = docMe.data.id;
  assert(!!doctorUserId, `Doctor ID: ${doctorUserId}`);

  // Patient generates consent code
  const gen = await api(patientToken).post(`/patients/${patientProfileId}/consent/generate`, {
    accessType: 'clinical_read',
  });
  assert(gen.status === 201 || gen.status === 200, `Generate consent → ${gen.status}`);
  const otp = gen.data.otp;
  assert(!!otp && otp.length === 6, `OTP received: ${otp}`);

  // Doctor redeems consent code
  const redeem = await api(doctorToken).post('/consent/redeem', { otp });
  assert(redeem.status === 201 || redeem.status === 200, `Redeem OTP → ${redeem.status}`);
  clinicalToken = redeem.data.clinicalToken;
  assert(!!clinicalToken, 'Clinical JWT received');

  // Patient lists active consents
  const list = await api(patientToken).get(`/patients/${patientProfileId}/consent/list`);
  assert(list.status === 200, `List consents → ${list.status}`);
  assert(Array.isArray(list.data), 'Consent list is array');
}

// ══════════════════════════════════════════════════════════════
// Journey 4: Medications + Allergies + Prescriptions
// ══════════════════════════════════════════════════════════════

async function journey4_medicationsAllergies() {
  // Add medications
  const addMed = await api(patientToken).post(`/patients/${patientProfileId}/medications`, {
    drugName: 'Ibuprofen',
    dosage: '400mg',
    frequency: 'twice daily',
    rxnormCode: '5640',
  });
  assert(addMed.status === 201 || addMed.status === 200, `Add medication → ${addMed.status}`);

  // Get medications
  const getMeds = await api(patientToken).get(`/patients/${patientProfileId}/medications`);
  assert(getMeds.status === 200, `GET medications → ${getMeds.status}`);
  assert(Array.isArray(getMeds.data) && getMeds.data.length > 0, `Has medications`);

  // Add allergy
  const addAllergy = await api(patientToken).post(`/patients/${patientProfileId}/allergies`, {
    allergen: 'Penicillin',
    severity: 'high',
    reaction: 'Anaphylaxis',
  });
  assert(addAllergy.status === 201 || addAllergy.status === 200, `Add allergy → ${addAllergy.status}`);

  // Get allergies
  const getAllergies = await api(patientToken).get(`/patients/${patientProfileId}/allergies`);
  assert(getAllergies.status === 200, `GET allergies → ${getAllergies.status}`);
  assert(Array.isArray(getAllergies.data) && getAllergies.data.length > 0, 'Has allergies');
}

// ══════════════════════════════════════════════════════════════
// Journey 5: Vitals + Alert Engine
// ══════════════════════════════════════════════════════════════

async function journey5_vitalsAlerts() {
  // Batch insert vitals (includes one emergency-level reading)
  const add = await api(patientToken).post(`/patients/${patientProfileId}/vitals`, {
    readings: [
      { metricType: 'heart_rate', value: 72, unit: 'bpm' },
      { metricType: 'bp_systolic', value: 145, unit: 'mmHg' },
      { metricType: 'spo2', value: 88, unit: '%' },  // Should trigger EMERGENCY
      { metricType: 'glucose', value: 110, unit: 'mg/dL' },
      { metricType: 'temperature', value: 98.6, unit: '°F' },
    ],
  });
  assert(add.status === 201 || add.status === 200, `Add vitals → ${add.status}`);
  const alertCount = add.data?.alerts?.length || 0;
  assert(alertCount > 0, `Alerts triggered: ${alertCount}`);

  // Check for emergency alert (SpO2 < 90)
  const hasEmergency = add.data?.alerts?.some((a: any) => a.tier === 'emergency');
  assert(hasEmergency, 'Emergency alert triggered for SpO2 < 90');

  // Get latest vitals
  const latest = await api(patientToken).get(`/patients/${patientProfileId}/vitals/latest`);
  assert(latest.status === 200, `GET latest vitals → ${latest.status}`);
  assert(!!latest.data.heart_rate, 'Has heart_rate in latest');

  // Get vitals with filter
  const filtered = await api(patientToken).get(`/patients/${patientProfileId}/vitals?metric=spo2&limit=5`);
  assert(filtered.status === 200, `GET filtered vitals → ${filtered.status}`);

  // Get active alerts
  const alerts = await api(patientToken).get(`/patients/${patientProfileId}/alerts?status=active`);
  assert(alerts.status === 200, `GET alerts → ${alerts.status}`);
  assert(Array.isArray(alerts.data) && alerts.data.length > 0, 'Has active alerts');

  // Resolve an alert
  if (alerts.data?.length > 0) {
    const alertId = alerts.data[0].id;
    const resolve = await api(patientToken).patch(`/patients/${patientProfileId}/alerts/${alertId}/resolve`);
    assert(resolve.status === 200, `Resolve alert → ${resolve.status}`);
  }
}

// ══════════════════════════════════════════════════════════════
// Journey 6: Clinical Notes + Diagnoses (Doctor via clinical token)
// ══════════════════════════════════════════════════════════════

async function journey6_clinicalNotes() {
  const clinicalApi = axios.create({
    baseURL: BASE,
    headers: {
      Authorization: `Bearer ${doctorToken}`,
      'X-Clinical-Token': clinicalToken,
    },
    validateStatus: () => true,
  });

  // Create SOAP note
  const note = await clinicalApi.post(`/patients/${patientProfileId}/notes`, {
    subjective: 'Patient reports persistent headache for 3 days.',
    objective: 'BP 145/90, HR 72, no focal neurological deficits.',
    assessment: 'Tension-type headache. R/O secondary causes.',
    plan: 'Start acetaminophen 500mg PRN. Follow-up 1 week. Consider CT if persists.',
    visitDate: '2026-03-29',
  });
  assert(note.status === 201 || note.status === 200, `Create SOAP note → ${note.status}`);

  // ICD-10 search
  const icd = await clinicalApi.get(`/clinical/icd10/search?q=headache`);
  assert(icd.status === 200, `ICD-10 search → ${icd.status}`);
  assert(Array.isArray(icd.data) && icd.data.length > 0, 'Found ICD-10 codes for headache');

  // Create diagnosis
  const dx = await clinicalApi.post(`/patients/${patientProfileId}/diagnoses`, {
    icd10Code: 'G44.1',
    icd10Description: 'Tension-type headache',
    status: 'active',
    diagnosisDate: '2026-03-29',
    notes: 'Chronic pattern, worsened by stress.',
  });
  assert(dx.status === 201 || dx.status === 200, `Create diagnosis → ${dx.status}`);

  // Get timeline  
  const timeline = await clinicalApi.get(`/patients/${patientProfileId}/timeline`);
  assert(timeline.status === 200, `GET timeline → ${timeline.status}`);
}

// ══════════════════════════════════════════════════════════════
// Journey 7: AI Service + Drug Search
// ══════════════════════════════════════════════════════════════

async function journey7_aiAndDrugs() {
  // Drug search (RxNorm)
  const search = await api(doctorToken).get('/drugs/search?q=aspirin');
  assert(search.status === 200, `Drug search → ${search.status}`);

  // AI chat
  const chat = await api(doctorToken).post('/ai/advisor/chat', {
    patientId: patientProfileId,
    message: 'What are the current drug interactions for this patient?',
  });
  assert(chat.status === 200 || chat.status === 201, `AI chat → ${chat.status}`);
  assert(!!chat.data.response, 'AI response received');

  // AI risk scores
  const risk = await api(doctorToken).get(`/patients/${patientProfileId}/ai/risk-scores`);
  assert(risk.status === 200, `AI risk scores → ${risk.status}`);
  assert(!!risk.data.cardiovascular, 'Has cardiovascular risk');
  assert(!!risk.data.disclaimer, 'Has AI disclaimer');

  // AI alerts
  const aiAlerts = await api(doctorToken).get(`/patients/${patientProfileId}/ai/alerts`);
  assert(aiAlerts.status === 200, `AI alerts → ${aiAlerts.status}`);
  assert(!!aiAlerts.data.disclaimer, 'Has AI alert disclaimer');

  // Preconsult brief
  const brief = await api(doctorToken).post(`/patients/${patientProfileId}/ai/preconsult-brief`);
  assert(brief.status === 200 || brief.status === 201, `Preconsult brief → ${brief.status}`);
  assert(!!brief.data.summary, 'Has preconsult summary');
}

// ══════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════

async function main() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║  MediCore E2E Integration Tests              ║');
  console.log('║  Target: http://localhost:3001/api/v1         ║');
  console.log('╚═══════════════════════════════════════════════╝');

  // Health check
  try {
    await axios.get(`${BASE}/auth/me`, { validateStatus: () => true, timeout: 3000 });
  } catch {
    console.error('\n❌ Backend is not reachable at localhost:3001. Start it first!\n');
    process.exit(1);
  }

  await runTest('Journey 1: Patient Registration + Auth', journey1_patientAuth);
  await runTest('Journey 2: Patient Profile CRUD', journey2_patientProfile);
  await runTest('Journey 3: Doctor Registration + Consent Flow', journey3_doctorConsent);
  await runTest('Journey 4: Medications + Allergies', journey4_medicationsAllergies);
  await runTest('Journey 5: Vitals + Alert Engine', journey5_vitalsAlerts);
  await runTest('Journey 6: Clinical Notes + Diagnoses', journey6_clinicalNotes);
  await runTest('Journey 7: AI Service + Drug Search', journey7_aiAndDrugs);

  // ── Summary ─────────────────────────────────────────────
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log(`║  Results: ${passed} passed, ${failed} failed${' '.repeat(Math.max(0, 24 - String(passed).length - String(failed).length))}║`);
  console.log('╚═══════════════════════════════════════════════╝');

  if (failures.length) {
    console.log('\nFailed assertions:');
    failures.forEach((f) => console.log(`  • ${f}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
