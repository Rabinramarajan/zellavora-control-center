export class AppError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public code: string = 'INTERNAL_SERVER_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleError(error: any) {
  console.error('[Error Occurred]', error);

  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.status,
        details: error.details,
      },
      status: error.status,
    };
  }

  // Handle standard database/Supabase errors
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code || 'DATABASE_ERROR',
        statusCode: 400,
      },
      status: 400,
    };
  }

  return {
    success: false,
    error: {
      message: error instanceof Error ? error.message : 'Internal Server Error',
      code: 'INTERNAL_SERVER_ERROR',
      statusCode: 500,
    },
    status: 500,
  };
}
