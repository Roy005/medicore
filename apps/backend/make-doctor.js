const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://medicore:medicore_secret@127.0.0.1:5433/medicore'
  });
  await client.connect();
  await client.query("UPDATE users SET role = 'doctor' WHERE email = 'realdoctor@medicore.com';");
  console.log("Made realdoctor a doctor in the DB.");
  await client.end();
}

main().catch(console.error);
