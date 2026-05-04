export class BadRequestError extends Error {
  constructor(message = 'An invalid request, generally a user error.') {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Request media item or device is not found.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnknownTypeError extends Error {
  constructor(message = 'Unknown library type.') {
    super(message);
    this.name = 'UnknownTypeError';
  }
}

export class UnsupportedError extends Error {
  constructor(message = 'Unsupported client request.') {
    super(message);
    this.name = 'UnsupportedError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Invalid username or password.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export const BadRequest = BadRequestError;
export const NotFound = NotFoundError;
export const UnknownType = UnknownTypeError;
export const Unsupported = UnsupportedError;
export const Unauthorized = UnauthorizedError;
