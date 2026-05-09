const https = require('https');

const API_BASE = 'https://api.loopcstrategies.com';
const TENANT = 'cg';

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
  // Login
  console.log('Logging in...');
  const loginRes = await httpRequest('POST', '/api/auth/login', {
    name: 'Nan',
    password: '123456',
    company: TENANT
  });
  
  const setCookies = loginRes.headers['set-cookie'];
  const cookieHeader = setCookies ? setCookies.map(c => c.split(';')[0]).join('; ') : '';
  
  if (loginRes.status !== 200 || !cookieHeader) {
    console.log('Login failed:', loginRes.status);
    return;
  }
  
  console.log('✓ Logged in\n');
  
  // Hard delete account 2301
  console.log('Hard deleting account 2301...');
  const deleteRes = await httpRequest('POST', '/api/erp-accounting/accounts/hard-delete-by-code', {
    code: '2301',
    confirm: true
  }, {
    Cookie: cookieHeader
  });
  
  console.log('Status:', deleteRes.status);
  console.log('Response:', JSON.stringify(deleteRes.data, null, 2));
  
  // Also clean up joshua vendor
  console.log('\nChecking for joshua vendor...');
  const vendorsRes = await httpRequest('GET', '/api/erp-accounting/vendors', null, {
    Cookie: cookieHeader
  });
  
  console.log('Vendors API status:', vendorsRes.status);
  
  if (vendorsRes.data.vendors) {
    const joshVendors = vendorsRes.data.vendors.filter(v => v.name?.toLowerCase().includes('joshua'));
    console.log(`Joshua vendors found: ${joshVendors.length}`);
    joshVendors.forEach(v => console.log(`  ${v.name} (${v.vendorCode})`));
  } else {
    console.log('Vendors response:', JSON.stringify(vendorsRes.data, null, 2).substring(0, 500));
  }
}

main();
