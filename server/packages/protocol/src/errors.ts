import { z } from 'zod';

export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_ENDED: 'SESSION_ENDED',
  SESSION_FULL: 'SESSION_FULL',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  ADMIN_REQUIRED: 'ADMIN_REQUIRED',
  NOT_PARTICIPANT: 'NOT_PARTICIPANT',
  PARTICIPANT_NOT_FOUND: 'PARTICIPANT_NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ErrorCodeSchema = z.nativeEnum(ErrorCode);

export interface ErrorResponse {
  error: ErrorCode;
  message: string;
}

export class ChatError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly httpStatus: number = 400
  ) {
    super(message);
    this.name = 'ChatError';
  }

  toResponse(): ErrorResponse {
    return {
      error: this.code,
      message: this.message,
    };
  }
}
