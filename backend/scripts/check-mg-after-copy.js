require('dotenv').config();

const apiBase = String(process.env.SMOKE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

function buildCredentials() {
  const entries = [
  { company: 'mg', name: 'loopcadmin', password: process.env.LOOPC_ADMIN_PASSWORD },
  { company: 'mg', name: 'mgadmin', password: process.env.MG_ADMIN_PASSWORD },
  ];
  const credentials = entries.filter((entry) => entry.password);
  if (!credentials.length) {
    throw new Error('Set MG_ADMIN_PASSWORD and/or LOOPC_ADMIN_PASSWORD before running this script.');
  }
  return credentials;
}

async function main() {
  const credentials = buildCredentials();

  let token = null;
  let activeUser = null;

  for (const cred of credentials) {
    const login = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cred),
    });

    const setCookie = login.headers.get('set-cookie') || '';
    const match = setCookie.match(/sessionToken=([^;]+)/);
    const body = await login.text();
    console.log(JSON.stringify({ tried: cred.name, status: login.status, preview: body.slice(0, 120) }));

    if (match && match[1]) {
      token = match[1];
      activeUser = cred.name;
      break;
    }
  }

  if (!token) {
    throw new Error('No MG login succeeded after copy');
  }

  const endpoints = [
    '/api/auth/me',
    '/api/crm/dashboard',
    '/api/erp/inventory',
    '/api/erp-accounting/reports/dashboard?startDate=2026-04-01&endDate=2026-04-30',
  ];

  for (const path of endpoints) {
    const res = await fetch(`${apiBase}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(JSON.stringify({ activeUser, path, status: res.status }));
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
