import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/index.js';

describe('hashPassword', () => {
  it('should produce a hash with salt:hash format', async () => {
    const hash = await hashPassword('mypassword');
    expect(hash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });

  it('should produce different hashes for same password (different salts)', async () => {
    const hash1 = await hashPassword('mypassword');
    const hash2 = await hashPassword('mypassword');
    expect(hash1).not.toBe(hash2);
  });
});

describe('verifyPassword', () => {
  it('should verify correct password', async () => {
    const hash = await hashPassword('mypassword');
    const isValid = await verifyPassword('mypassword', hash);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const hash = await hashPassword('mypassword');
    const isValid = await verifyPassword('wrongpassword', hash);
    expect(isValid).toBe(false);
  });

  it('should reject empty password', async () => {
    const hash = await hashPassword('mypassword');
    const isValid = await verifyPassword('', hash);
    expect(isValid).toBe(false);
  });

  it('should handle malformed hash gracefully', async () => {
    const isValid = await verifyPassword('mypassword', 'invalid-hash');
    expect(isValid).toBe(false);
  });
});
