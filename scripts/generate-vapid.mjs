import { generateKeyPairSync } from 'node:crypto';

function toBase64Url(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });

const publicJwk = publicKey.export({ format: 'jwk' });
const privateJwk = privateKey.export({ format: 'jwk' });

const x = Buffer.from(publicJwk.x, 'base64url');
const y = Buffer.from(publicJwk.y, 'base64url');
const d = Buffer.from(privateJwk.d, 'base64url');

const uncompressed = Buffer.concat([Buffer.from([0x04]), x, y]);

console.log('VAPID_PUBLIC_KEY=', toBase64Url(uncompressed));
console.log('VAPID_PRIVATE_KEY=', toBase64Url(d));
console.log('VAPID_SUBJECT= mailto:seu-email@exemplo.com');
