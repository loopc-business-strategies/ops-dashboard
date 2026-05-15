require('./_destructive-guard')({ scriptName: __filename })
const https = require('https');

const API_BASE = 'https://api.loopcstrategies.com';
const TENANT = 'cg';
const ADMIN_PASSWORD = process.env.CG_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  throw new Error('CG_ADMIN_PASSWORD or ADMIN_PASSWORD is required.');
}

function httpRequest(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const data = body ? JSON.stringify(body) : null;
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT,
        ...headers
      }
    };
    
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: responseData, headers: res.headers });
        }
      });
    });
    
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Login to get cookie
  console.log('Logging in...');
  const loginRes = await httpRequest('POST', '/api/auth/login', {
    name: 'Nan',
    password: ADMIN_PASSWORD,
    company: TENANT
  });
  
  console.log('Login status:', loginRes.status);
  
  if (loginRes.status !== 200) {
    console.log('Login failed:', JSON.stringify(loginRes.data, null, 2));
    return;
  }
  
  // Extract cookie from Set-Cookie header
  const setCookies = loginRes.headers['set-cookie'];
  const cookieHeader = setCookies ? setCookies.map(c => c.split(';')[0]).join('; ') : '';
  console.log('✓ Logged in. Cookie:', cookieHeader ? 'obtained' : 'not found');
  
  if (!cookieHeader) {
    console.log('No cookie in response. Headers:', JSON.stringify(loginRes.headers, null, 2));
    return;
  }
  
  // Get all accounts
  console.log('\nFetching accounts...');
  const accountsRes = await httpRequest('GET', '/api/erp-accounting/accounts', null, {
    Cookie: cookieHeader
  });
  
  if (!accountsRes.data.accounts) {
    console.log('Failed to get accounts:', accountsRes.status, JSON.stringify(accountsRes.data, null, 2));
    return;
  }
  
  const accounts = accountsRes.data.accounts;
  console.log(`Total accounts: ${accounts.length}`);
  
  // Find joshua accounts
  const joshuaAccounts = accounts.filter(a => 
    a.accountName?.toLowerCase().includes('joshua') ||
    a.accountCode === '2301'
  );
  
  console.log(`\nJoshua/2301 accounts found: ${joshuaAccounts.length}`);
  joshuaAccounts.forEach(a => {
    console.log(`  ${a.accountCode} - ${a.accountName} (ID: ${a._id})`);
  });
  
  // Delete each one
  for (const acc of joshuaAccounts) {
    console.log(`\nDeleting ${acc.accountCode} - ${acc.accountName}...`);
    const deleteRes = await httpRequest('DELETE', `/api/erp-accounting/accounts/${acc._id}`, null, {
      Cookie: cookieHeader
    });
    console.log('Delete status:', deleteRes.status);
    console.log('Response:', JSON.stringify(deleteRes.data, null, 2));
  }
}

main();
