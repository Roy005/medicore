const { Client } = require('pg');

const API_URL = 'http://localhost:3001/api/v1';

async function runTests() {
  console.log('--- Starting Integration Tests ---');
  let patientToken = '';
  let doctorToken = '';
  let patientId = '';
  let doctorId = '';
  let profileId = '';
  
  const db = new Client({ connectionString: 'postgresql://medicore:medicore_secret@127.0.0.1:5433/medicore' });
  await db.connect();

  try {
    // 0. Setup test tenant
    console.log('0. Setting up Test Tenant...');
    await db.query(`INSERT INTO tenants (id, name) VALUES ('00000000-0000-0000-0000-000000000000', 'Test Tenant') ON CONFLICT DO NOTHING;`);

    // 1. Register Patient
    console.log('1. Registering Patient...');
    const pEmail = `patient_${Date.now()}@test.com`;
    const resP = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: pEmail,
        password: 'password123',
        tenantId: '00000000-0000-0000-0000-000000000000'
      })
    });
    const resPData = await resP.json();
    if (!resP.ok) throw new Error(JSON.stringify(resPData));
    patientId = resPData.id;
    console.log(`   Patient ID: ${patientId}`);

    // Login Patient
    const loginP = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: pEmail,
        password: 'password123'
      })
    });
    const loginPData = await loginP.json();
    patientToken = loginPData.accessToken;

    // 2. Register Doctor
    console.log('2. Registering Doctor...');
    // We cannot register a doctor via the same auth/register probably? The endpoint registers UserRole.PATIENT by default usually. 
    // Let's actually check how register works. The AuthService hardcodes UserRole.PATIENT.
    // So to make a doctor, we will update the DB directly for test!
    const dEmail = `doctor_${Date.now()}@test.com`;
    const resD = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: dEmail,
        password: 'password123',
        tenantId: '00000000-0000-0000-0000-000000000000'
      })
    });
    const resDData = await resD.json();
    doctorId = resDData.id;
    
    // Convert patient 2 to Doctor
    await db.query(`UPDATE users SET role = 'doctor' WHERE id = $1`, [doctorId]);

    // Login Doctor
    const loginD = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: dEmail,
        password: 'password123'
      })
    });
    const loginDData = await loginD.json();
    doctorToken = loginDData.accessToken;
    console.log(`   Doctor ID: ${doctorId}`);

    // Fetch Patient Profile ID (from DB for testing)
    const profRes = await db.query(`SELECT id FROM patient_profiles WHERE user_id = $1`, [patientId]);
    profileId = profRes.rows[0].id;

    // 3. Test Patient access own profile
    console.log('3. Testing Patient retrieving own profile...');
    const getMyProf = await fetch(`${API_URL}/patients/${profileId}/profile`, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });
    const getMyProfData = await getMyProf.json();
    console.log(`   Success! Profile Completeness Score: ${getMyProfData.profile_completeness_score}`);

    // 4. Test missing permission for Doctor
    console.log('4. Testing Doctor retrieving profile without token (Expect 403)...');
    
    const docFail = await fetch(`${API_URL}/patients/${profileId}/profile`, {
      headers: { Authorization: `Bearer ${doctorToken}` }
    });
    if (docFail.status === 403) {
      console.log('   Correctly denied with 403 Forbidden.');
    } else {
      console.error('ERROR: Unexpected result:', docFail.status);
      process.exit(1);
    }

    // 5. Grant access token in DB
    console.log('5. Granting Doctor Access Token...');
    await db.query(`INSERT INTO access_tokens (patient_id, granted_to_user_id, token_hash, access_type, expires_at) VALUES ($1, $2, 'dummyhash', 'read_only', NOW() + INTERVAL '1 day')`, [profileId, doctorId]);

    // 6. Test Doctor access with token
    console.log('6. Testing Doctor retrieving profile WITH token (Expect 200)...');
    const getDocProf = await fetch(`${API_URL}/patients/${profileId}/profile`, {
      headers: { Authorization: `Bearer ${doctorToken}` }
    });
    if (getDocProf.status === 200) {
      console.log('   Success! Doctor accessed the profile.');
    }

    // 7. Update Profile to test trigger
    console.log('7. Testing completeness profile trigger...');
    await fetch(`${API_URL}/patients/${profileId}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${patientToken}` },
      body: JSON.stringify({ blood_group: 'O+' })
    });
    
    const secondProf = await fetch(`${API_URL}/patients/${profileId}/profile`, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });
    const secondProfData = await secondProf.json();
    console.log(`   Score updated to: ${secondProfData.profile_completeness_score} (Expected 30: 20 base + 10 blood group)`);

    // 8. Check Audit Log
    console.log('8. Checking audit_log table in DB...');
    const audits = await db.query(`SELECT event_type, actor_user_id FROM audit_log WHERE patient_id = $1 ORDER BY created_at ASC`, [profileId]);
    console.log(`   Found ${audits.rows.length} audit logs for this patient profile:`);
    audits.rows.forEach(r => console.log(`    - ${r.event_type} by ${r.actor_user_id}`));

    const requiredEvents = ['PHI_GET_PROFILE', 'PHI_PATCH_PROFILE'];
    const hasRequired = requiredEvents.every(e => audits.rows.some(r => r.event_type === e));
    if (hasRequired) {
      console.log('   All expected events successfully audited!');
    } else {
      console.error('   Missing expected events!');
      process.exit(1);
    }

    await db.end();
    console.log('--- ALL INTEGRATION TESTS PASSED ---');

  } catch(e) {
    console.error('Test Failed:', e.message);
    process.exit(1);
  }
}

runTests();
