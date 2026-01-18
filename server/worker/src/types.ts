export interface Env {
  SESSION: DurableObjectNamespace;
  RATE_LIMIT: DurableObjectNamespace;
  ENVIRONMENT?: string;
  STAGING_AUTH_TOKEN?: string;  // Secret: only set in staging
}

export interface StoredSession {
  id: string;
  passwordHash: string;
  adminPasswordHash: string;
  createdAt: number;
  createdBy: string;
  expiresAt: number;
  lastActivity: number;
  ended: boolean;
}

export interface StoredParticipant {
  id: string;
  displayName: string;
  joinedAt: number;
  lastSeen: number;
  isAdmin: boolean;
}

export interface StoredMessage {
  id: string;
  from: string;
  content: string;
  timestamp: number;
}

export const STORAGE_KEYS = {
  SESSION: 'session',
  PARTICIPANTS: 'participants',
  MESSAGES: 'messages',
  READ_CURSORS: 'read_cursors',
} as const;
