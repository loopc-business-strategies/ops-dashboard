/**
 * Some local DNS stubs (VPN, Docker, Windows resolvers) cannot resolve MongoDB
 * Atlas SRV records even when OS nslookup works. Force Node to use public resolvers
 * before any Mongoose / mongodb+srv connection.
 *
 * Override via DNS_SERVERS or ATLAS_DNS_SERVERS, e.g. "1.1.1.1,1.0.0.1".
 */
const dns = require('node:dns')

function resolveDnsServers() {
  const raw = process.env.DNS_SERVERS || process.env.ATLAS_DNS_SERVERS || ''
  const fromEnv = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return fromEnv.length ? fromEnv : ['8.8.8.8', '1.1.1.1']
}

function configureAtlasDns() {
  dns.setServers(resolveDnsServers())
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first')
  }
}

configureAtlasDns()

module.exports = { configureAtlasDns, resolveDnsServers }
