async function main() {
  const credentials = [
    { company: 'mg', name: 'loopcadmin', password: 'LoopcAdmin@2026!' },
    { company: 'mg', name: 'mgadmin', password: 'MgAdmin@2026!' },
  ];

  let token = null;
  let activeUser = null;

  for (const cred of credentials) {
    const login = await fetch('http://localhost:5000/api/auth/login', {
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
    const res = await fetch(`http://localhost:5000${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(JSON.stringify({ activeUser, path, status: res.status }));
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
