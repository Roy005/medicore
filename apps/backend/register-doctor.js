const http = require('http');

const data = JSON.stringify({
  email: 'realdoctor@medicore.com',
  password: 'Password123!',
  role: 'doctor',
  firstName: 'Gregory',
  lastName: 'House'
});

const options = {
  hostname: '127.0.0.1',
  port: 3001,
  path: '/api/v1/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
