import { describe, it, expect } from 'vitest';
import {
  generateSessionId,
  generateParticipantId,
  generateMessageId,
  generatePassword,
} from '../src/index.js';

describe('generateSessionId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateSessionId();
    const id2 = generateSessionId();
    expect(id1).not.toBe(id2);
  });

  it('should generate IDs with expected format', () => {
    const id = generateSessionId();
    expect(id.length).toBeGreaterThan(10);
    expect(id).toMatch(/^[a-z0-9]+$/);
  });
});

describe('generateParticipantId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateParticipantId();
    const id2 = generateParticipantId();
    expect(id1).not.toBe(id2);
  });

  it('should generate IDs with p_ prefix', () => {
    const id = generateParticipantId();
    expect(id).toMatch(/^p_[a-z0-9]+$/);
  });
});

describe('generateMessageId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateMessageId();
    const id2 = generateMessageId();
    expect(id1).not.toBe(id2);
  });

  it('should generate IDs with m_ prefix', () => {
    const id = generateMessageId();
    expect(id).toMatch(/^m_[a-z0-9]+$/);
  });
});

describe('generatePassword', () => {
  it('should generate unique passwords', () => {
    const pw1 = generatePassword();
    const pw2 = generatePassword();
    expect(pw1).not.toBe(pw2);
  });

  it('should generate passwords of expected length', () => {
    const pw = generatePassword();
    expect(pw.length).toBe(48);
  });

  it('should generate hex passwords', () => {
    const pw = generatePassword();
    expect(pw).toMatch(/^[0-9a-f]+$/);
  });
});
