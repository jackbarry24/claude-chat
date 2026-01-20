const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  const hashArray = new Uint8Array(derivedBits);
  const saltHex = Array.from(salt, (b) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(hashArray, (b) => b.toString(16).padStart(2, '0')).join('');
  
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, expectedHashHex] = storedHash.split(':');
  if (!saltHex || !expectedHashHex) {
    return false;
  }

  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  const hashArray = new Uint8Array(derivedBits);
  const actualHashHex = Array.from(hashArray, (b) => b.toString(16).padStart(2, '0')).join('');

  const actualHashBytes = hexToBytes(actualHashHex);
  const expectedHashBytes = hexToBytes(expectedHashHex);

  if (actualHashBytes.length !== expectedHashBytes.length) {
    crypto.subtle.timingSafeEqual(actualHashBytes, actualHashBytes);
    return false;
  }

  return crypto.subtle.timingSafeEqual(actualHashBytes, expectedHashBytes);
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    return new Uint8Array();
  }

  const pairs = hex.match(/.{2}/g);
  if (!pairs) {
    return new Uint8Array();
  }

  const bytes = new Uint8Array(pairs.length);
  for (let i = 0; i < pairs.length; i++) {
    bytes[i] = Number.parseInt(pairs[i], 16);
  }
  return bytes;
}
