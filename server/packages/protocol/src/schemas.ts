import { z } from 'zod';
import { DEFAULT_MESSAGE_LIMIT, MAX_MESSAGE_LIMIT } from './session.js';

export const DisplayNameSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z.string()
      .min(1, 'Display name is required')
      .max(100, 'Display name must be 100 characters or less')
  );

export const SessionIdSchema = z
  .string()
  .min(1, 'Session ID is required')
  .max(50, 'Session ID too long');

export const PasswordSchema = z
  .string()
  .min(1, 'Password is required');

export const ParticipantIdSchema = z
  .string()
  .min(1, 'Participant ID is required');

export const MessageContentSchema = z
  .string()
  .min(1, 'Message cannot be empty')
  .max(50000, 'Message must be 50,000 characters or less');

export const MessageIdSchema = z.string().optional();

export const LimitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_MESSAGE_LIMIT)
  .default(DEFAULT_MESSAGE_LIMIT);

export const CreateSessionRequestSchema = z.object({
  display_name: DisplayNameSchema,
});

export const JoinSessionRequestSchema = z.object({
  display_name: DisplayNameSchema,
});

export const SendMessageRequestSchema = z.object({
  participant_id: ParticipantIdSchema,
  content: MessageContentSchema,
});

export const ReadMessagesQuerySchema = z.object({
  participant_id: ParticipantIdSchema,
  limit: LimitSchema,
  after: z.string().optional(),
});

export const LeaveSessionRequestSchema = z.object({
  session_password: PasswordSchema,
});

export const RemoveParticipantRequestSchema = z.object({
  session_password: PasswordSchema,
  admin_password: PasswordSchema.optional(),
});

export const EndSessionRequestSchema = z.object({
  admin_password: PasswordSchema,
});

export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;
export type JoinSessionRequest = z.infer<typeof JoinSessionRequestSchema>;
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;
export type ReadMessagesQuery = z.infer<typeof ReadMessagesQuerySchema>;
export type LeaveSessionRequest = z.infer<typeof LeaveSessionRequestSchema>;
export type RemoveParticipantRequest = z.infer<typeof RemoveParticipantRequestSchema>;
export type EndSessionRequest = z.infer<typeof EndSessionRequestSchema>;

export function formatZodErrors(error: z.ZodError): string {
  return error.errors
    .map((e) => {
      const path = e.path.join('.');
      return path ? `${path}: ${e.message}` : e.message;
    })
    .join('; ');
}
