type SubscriptionKeys = {
  p256dh: string;
  auth: string;
};

type PushSubscriptionRecord = {
  endpoint: string;
  keys: SubscriptionKeys;
};

function base64UrlToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function uint8ArrayToBase64Url(value: Uint8Array) {
  let binary = '';
  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importClientPublicKey(p256dh: string) {
  const keyData = base64UrlToUint8Array(p256dh);
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

async function generateServerKeys() {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
}

async function exportRawPublicKey(key: CryptoKey) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw);
}

async function hkdfExtract(salt: ArrayBuffer, ikm: ArrayBuffer) {
  const key = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new Uint8Array() },
    key,
    256
  );
}

async function hkdfExpand(prk: ArrayBuffer, salt: ArrayBuffer, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey('raw', prk, { name: 'HKDF' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

async function deriveAesKeys(sharedSecret: ArrayBuffer, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array, auth: Uint8Array, salt: Uint8Array) {
  const info = new Uint8Array([
    ...new TextEncoder().encode('WebPush: info\0'),
    ...clientPublicKey,
    ...serverPublicKey
  ]);
  const prk = await hkdfExpand(sharedSecret, auth, info, 32);
  const contentEncryptionKey = await hkdfExpand(prk.buffer, salt.buffer, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk.buffer, salt.buffer, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);
  return { contentEncryptionKey, nonce };
}

async function encryptPayload(payload: string, clientPublicKey: Uint8Array, auth: Uint8Array) {
  const serverKeys = await generateServerKeys();
  const serverPublicKey = await exportRawPublicKey(serverKeys.publicKey);
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: await crypto.subtle.importKey('raw', clientPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, true, []) },
    serverKeys.privateKey,
    256
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { contentEncryptionKey, nonce } = await deriveAesKeys(sharedSecret, clientPublicKey, serverPublicKey, auth, salt);

  const padding = new Uint8Array([0x00, 0x00]);
  const body = new TextEncoder().encode(payload);
  const plaintext = new Uint8Array(padding.length + body.length);
  plaintext.set(padding, 0);
  plaintext.set(body, padding.length);

  const cryptoKey = await crypto.subtle.importKey('raw', contentEncryptionKey, { name: 'AES-GCM', length: 128 }, false, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cryptoKey, plaintext);

  return {
    ciphertext: new Uint8Array(ciphertext),
    salt,
    serverPublicKey
  };
}

async function createVapidJwt(audience: string, subject: string, publicKey: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp: now + 12 * 60 * 60, sub: subject };

  const encode = (obj: Record<string, unknown>) =>
    uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(obj)));

  const signingInput = `${encode(header)}.${encode(payload)}`;

  const publicRaw = base64UrlToUint8Array(publicKey);
  const d = base64UrlToUint8Array(privateKey);
  const x = publicRaw.slice(1, 33);
  const y = publicRaw.slice(33, 65);

  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: uint8ArrayToBase64Url(x),
    y: uint8ArrayToBase64Url(y),
    d: uint8ArrayToBase64Url(d)
  };

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${uint8ArrayToBase64Url(new Uint8Array(signature))}`;
}

export async function sendWebPush(subscription: PushSubscriptionRecord, payload: Record<string, unknown>, options: {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
}) {
  const endpoint = subscription.endpoint;
  const audience = new URL(endpoint).origin;
  const jwt = await createVapidJwt(audience, options.vapidSubject, options.vapidPublicKey, options.vapidPrivateKey);

  const clientPublicKey = base64UrlToUint8Array(subscription.keys.p256dh);
  const auth = base64UrlToUint8Array(subscription.keys.auth);
  const encrypted = await encryptPayload(JSON.stringify(payload), clientPublicKey, auth);

  const headers: Record<string, string> = {
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    'TTL': '300',
    'Authorization': `vapid t=${jwt}, k=${options.vapidPublicKey}`,
    'Crypto-Key': `dh=${uint8ArrayToBase64Url(encrypted.serverPublicKey)}`
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: encrypted.ciphertext
  });

  return response;
}
