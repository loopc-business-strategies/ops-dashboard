/**
 * Local-only helper: some Windows resolvers refuse MongoDB SRV lookups.
 * Force public DNS before connecting (used by migrate when querySrv fails).
 */
const dns = require('node:dns')
dns.setServers(['8.8.8.8', '1.1.1.1'])
dns.setDefaultResultOrder('ipv4first')
