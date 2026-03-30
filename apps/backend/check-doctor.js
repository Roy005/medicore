const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://medicore:medicore_secret@127.0.0.1:5433/medicore'
  });
  await client.connect();

  const res = await client.query("SELECT * FROM users WHERE role = 'doctor' LIMIT 1;");
  if (res.rows.length > 0) {
    console.log("DOCTOR_FOUND:", res.rows[0].email);
  } else {
    // try finding any user to turn into a doctor
    const anyUser = await client.query("SELECT * FROM users LIMIT 1;");
    if (anyUser.rows.length > 0) {
      await client.query("UPDATE users SET role = 'doctor' WHERE id = $1", [anyUser.rows[0].id]);
      console.log("UPDATED_USER_TO_DOCTOR:", anyUser.rows[0].email);
    } else {
      console.log("NO_USERS_IN_DB_PLEASE_REGISTER_FIRST");
    }
  }

  await client.end();
}

main().catch(console.error);
