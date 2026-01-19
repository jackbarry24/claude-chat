export interface Session {
  id: string;
  passwordHash: string;
  adminPasswordHash: string;
  createdAt: number;
  createdBy: string;
  expiresAt: number;
  lastActivity: number;
  ended: boolean;
}

export interface Participant {
  id: string;
  displayName: string;
  joinedAt: number;
  lastSeen: number;
  isAdmin: boolean;
}

export interface Message {
  id: string;
  from: string;
  content: string;
  timestamp: number;
}

export interface LocalSessionFile {
  session_id: string;
  session_password: string;
  admin_password?: string;
  participant_id: string;
  auth_token: string;
  display_name: string;
  server_url: string;
  created_at: number;
  is_admin: boolean;
}

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const MAX_MESSAGES = 1000;
export const DEFAULT_MESSAGE_LIMIT = 100;
export const MAX_MESSAGE_LIMIT = 500;
export const MAX_PARTICIPANTS = 3;

export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `${timestamp}${random}`;
}

export function generateParticipantId(): string {
  return `p_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function generateMessageId(): string {
  return `m_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function generatePassword(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}
