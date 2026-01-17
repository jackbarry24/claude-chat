import { describe, it, expect } from 'vitest';
import {
  DisplayNameSchema,
  SessionIdSchema,
  PasswordSchema,
  ParticipantIdSchema,
  MessageContentSchema,
  LimitSchema,
  CreateSessionRequestSchema,
  JoinSessionRequestSchema,
  SendMessageRequestSchema,
  ReadMessagesQuerySchema,
  formatZodErrors,
} from '../src/index.js';

describe('DisplayNameSchema', () => {
  it('should accept valid display names', () => {
    expect(DisplayNameSchema.safeParse('Alice').success).toBe(true);
    expect(DisplayNameSchema.safeParse('Bob Smith').success).toBe(true);
    expect(DisplayNameSchema.safeParse('A').success).toBe(true);
  });

  it('should trim whitespace', () => {
    const result = DisplayNameSchema.safeParse('  Alice  ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('Alice');
    }
  });

  it('should reject empty strings', () => {
    expect(DisplayNameSchema.safeParse('').success).toBe(false);
    expect(DisplayNameSchema.safeParse('   ').success).toBe(false);
  });

  it('should reject names over 100 characters', () => {
    const longName = 'A'.repeat(101);
    expect(DisplayNameSchema.safeParse(longName).success).toBe(false);
  });
});

describe('SessionIdSchema', () => {
  it('should accept valid session IDs', () => {
    expect(SessionIdSchema.safeParse('abc123xyz').success).toBe(true);
    expect(SessionIdSchema.safeParse('lz4kx8j7abc123def456').success).toBe(true);
  });

  it('should reject empty strings', () => {
    expect(SessionIdSchema.safeParse('').success).toBe(false);
  });
});

describe('PasswordSchema', () => {
  it('should accept valid passwords', () => {
    expect(PasswordSchema.safeParse('password123').success).toBe(true);
    expect(PasswordSchema.safeParse('a').success).toBe(true);
  });

  it('should reject empty strings', () => {
    expect(PasswordSchema.safeParse('').success).toBe(false);
  });
});

describe('MessageContentSchema', () => {
  it('should accept valid message content', () => {
    expect(MessageContentSchema.safeParse('Hello, world!').success).toBe(true);
    expect(MessageContentSchema.safeParse('A').success).toBe(true);
  });

  it('should reject empty content', () => {
    expect(MessageContentSchema.safeParse('').success).toBe(false);
  });

  it('should reject content over 50,000 characters', () => {
    const longContent = 'A'.repeat(50001);
    expect(MessageContentSchema.safeParse(longContent).success).toBe(false);
  });

  it('should accept content at exactly 50,000 characters', () => {
    const maxContent = 'A'.repeat(50000);
    expect(MessageContentSchema.safeParse(maxContent).success).toBe(true);
  });
});

describe('LimitSchema', () => {
  it('should coerce string numbers', () => {
    const result = LimitSchema.safeParse('50');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(50);
    }
  });

  it('should enforce max limit of 500', () => {
    expect(LimitSchema.safeParse(500).success).toBe(true);
    expect(LimitSchema.safeParse(501).success).toBe(false);
  });

  it('should enforce min limit of 1', () => {
    expect(LimitSchema.safeParse(1).success).toBe(true);
    expect(LimitSchema.safeParse(0).success).toBe(false);
  });
});

describe('CreateSessionRequestSchema', () => {
  it('should accept valid request', () => {
    const result = CreateSessionRequestSchema.safeParse({
      display_name: 'Alice',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing display_name', () => {
    const result = CreateSessionRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject empty display_name', () => {
    const result = CreateSessionRequestSchema.safeParse({ display_name: '' });
    expect(result.success).toBe(false);
  });
});

describe('JoinSessionRequestSchema', () => {
  it('should accept valid request', () => {
    const result = JoinSessionRequestSchema.safeParse({
      display_name: 'Bob',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing display_name', () => {
    const result = JoinSessionRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject empty display_name', () => {
    const result = JoinSessionRequestSchema.safeParse({
      display_name: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('SendMessageRequestSchema', () => {
  it('should accept valid request', () => {
    const result = SendMessageRequestSchema.safeParse({
      participant_id: 'p_12345',
      content: 'Hello!',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty content', () => {
    const result = SendMessageRequestSchema.safeParse({
      participant_id: 'p_12345',
      content: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing participant_id', () => {
    const result = SendMessageRequestSchema.safeParse({
      content: 'Hello!',
    });
    expect(result.success).toBe(false);
  });
});

describe('ReadMessagesQuerySchema', () => {
  it('should accept valid query with defaults', () => {
    const result = ReadMessagesQuerySchema.safeParse({
      participant_id: 'p_12345',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(100);
    }
  });

  it('should coerce and accept limit', () => {
    const result = ReadMessagesQuerySchema.safeParse({
      participant_id: 'p_12345',
      limit: '50',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it('should accept optional after cursor', () => {
    const result = ReadMessagesQuerySchema.safeParse({
      participant_id: 'p_12345',
      after: 'm_abc123',
    });
    expect(result.success).toBe(true);
  });
});

describe('formatZodErrors', () => {
  it('should format errors into readable string', () => {
    const result = CreateSessionRequestSchema.safeParse({});
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      expect(formatted).toContain('display_name');
    }
  });
});
