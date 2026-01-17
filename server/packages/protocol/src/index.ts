export {
  ErrorCode,
  ErrorCodeSchema,
  ChatError,
  type ErrorResponse,
} from './errors.js';

export {
  type Session,
  type Participant,
  type Message,
  type LocalSessionFile,
  SESSION_TTL_MS,
  MAX_MESSAGES,
  DEFAULT_MESSAGE_LIMIT,
  MAX_MESSAGE_LIMIT,
  MAX_PARTICIPANTS,
  generateSessionId,
  generateParticipantId,
  generateMessageId,
  generatePassword,
} from './session.js';

export {
  DisplayNameSchema,
  SessionIdSchema,
  PasswordSchema,
  ParticipantIdSchema,
  MessageContentSchema,
  MessageIdSchema,
  LimitSchema,
  CreateSessionRequestSchema,
  JoinSessionRequestSchema,
  SendMessageRequestSchema,
  ReadMessagesQuerySchema,
  LeaveSessionRequestSchema,
  RemoveParticipantRequestSchema,
  EndSessionRequestSchema,
  type CreateSessionRequest,
  type JoinSessionRequest,
  type SendMessageRequest,
  type ReadMessagesQuery,
  type LeaveSessionRequest,
  type RemoveParticipantRequest,
  type EndSessionRequest,
  formatZodErrors,
} from './schemas.js';

export {
  type CreateSessionResponse,
  type JoinSessionResponse,
  type ParticipantInfo,
  type ParticipantLike,
  type SendMessageResponse,
  type MessageInfo,
  type ReadMessagesResponse,
  type ListParticipantsResponse,
  type SuccessResponse,
  type EndSessionResponse,
  type SessionInfoResponse,
  toParticipantInfo,
  toMessageInfo,
} from './responses.js';

export {
  hashPassword,
  verifyPassword,
} from './crypto.js';
