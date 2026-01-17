import type { Message } from './session.js';

/**
 * Base participant shape for conversion functions.
 * Works with both Participant from session.ts and StoredParticipant from worker types.
 */
export interface ParticipantLike {
  id: string;
  displayName: string;
  joinedAt: number;
  lastSeen: number;
  isAdmin: boolean;
}

export interface CreateSessionResponse {
  session_id: string;
  session_password: string;
  admin_password: string;
  participant_id: string;
  created_at: number;
  expires_at: number;
}

export interface JoinSessionResponse {
  success: true;
  participant_id: string;
  participants: ParticipantInfo[];
}

export interface ParticipantInfo {
  id: string;
  display_name: string;
  joined_at: number;
  is_admin: boolean;
}

export interface SendMessageResponse {
  success: true;
  message_id: string;
  timestamp: number;
}

export interface MessageInfo {
  id: string;
  from: {
    id: string;
    display_name: string;
  };
  content: string;
  timestamp: number;
}

export interface ReadMessagesResponse {
  messages: MessageInfo[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface ListParticipantsResponse {
  participants: ParticipantInfo[];
}

export interface SuccessResponse {
  success: true;
}

export interface EndSessionResponse {
  success: true;
  message: string;
}

export interface SessionInfoResponse {
  session_id: string;
  created_at: number;
  expires_at: number;
  participant_count: number;
  message_count: number;
  is_ended: boolean;
}

export function toParticipantInfo(p: ParticipantLike): ParticipantInfo {
  return {
    id: p.id,
    display_name: p.displayName,
    joined_at: p.joinedAt,
    is_admin: p.isAdmin,
  };
}

export function toMessageInfo(m: Message, participants: Map<string, ParticipantLike>): MessageInfo {
  const sender = participants.get(m.from);
  return {
    id: m.id,
    from: {
      id: m.from,
      display_name: sender?.displayName ?? 'Unknown',
    },
    content: m.content,
    timestamp: m.timestamp,
  };
}
