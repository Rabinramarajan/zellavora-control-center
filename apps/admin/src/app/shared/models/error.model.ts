export interface FieldError {
  field: string;
  message: string;
  code?: string;
}

export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
  details?: any;
}

export interface ValidationError extends ApiError {
  errors: FieldError[];
}

export interface UnauthorizedError extends ApiError {
  expiredAt?: string;
}

export interface ForbiddenError extends ApiError {
  requiredPermission?: string;
  requiredRole?: string;
}

export interface NotFoundError extends ApiError {
  resourceId?: string;
  resourceType?: string;
}

export interface ConflictError extends ApiError {
  conflictingKey?: string;
}
