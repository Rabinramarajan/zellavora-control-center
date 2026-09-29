/**
 * Prints a TRANSPORT_PRIVATE_KEY line for .env.local / the Vercel dashboard.
 *
 *   node scripts/generate-transport-key.cjs
 */
const crypto = require('crypto');

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
console.log(`TRANSPORT_PRIVATE_KEY="${pem.trim().replace(/\n/g, '\\n')}"`);
