const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://medicore:medicore_secret@127.0.0.1:5433/medicore' });
async function check() {
  await client.connect();
  try {
    const res = await client.query("SELECT * FROM vitals WHERE patient_id = 'f97708be-ad22-4d1b-a331-8e3b5a597a59' AND metric_type = 'weight' LIMIT 1;");
    console.log(res.rows);
  } catch (e) {
    console.log('Enum error:', e.message);
    const q2 = await client.query("SELECT data_type, udt_name FROM information_schema.columns WHERE table_name = 'vitals' AND column_name = 'metric_type';");
    console.log('Column details:', q2.rows);
  }
  await client.end();
}
check();
