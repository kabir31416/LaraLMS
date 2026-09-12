/** A single shape for every error the API returns — see the response envelope in Phase 2 §12. */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly fields?: Record<string, string[]>;

  constructor(statusCode: number, code: string, message: string, fields?: Record<string, string[]>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = "Bad request", fields?: Record<string, string[]>) {
    return new ApiError(400, "BAD_REQUEST", message, fields);
  }
  static unauthorized(message = "Authentication required") {
    return new ApiError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "You do not have permission to do this") {
    return new ApiError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Not found") {
    return new ApiError(404, "NOT_FOUND", message);
  }
  static conflict(message = "Conflict") {
    return new ApiError(409, "CONFLICT", message);
  }
  static tooManyRequests(message = "Too many requests") {
    return new ApiError(429, "TOO_MANY_REQUESTS", message);
  }
  static internal(message = "Something went wrong") {
    return new ApiError(500, "INTERNAL", message);
  }
}
