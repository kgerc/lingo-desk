import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export const errorHandler = (
  err: ApiError,
  res: Response
) => {
  console.error('Error:', err);

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.errors,
      },
    });
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_ENTRY',
          message: 'A record with this value already exists',
          details: err.meta,
        },
      });
    }

    // Foreign key constraint failed
    if (err.code === 'P2003') {
      return res.status(400).json({
        error: {
          code: 'INVALID_REFERENCE',
          message: 'Referenced record does not exist',
          details: err.meta,
        },
      });
    }

    // Record not found
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Record not found',
        },
      });
    }
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  return res.status(statusCode).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};
