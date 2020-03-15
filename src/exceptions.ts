export class BadRequest extends Error {
  message = 'An invalid request, generally a user error.';
}

export class NotFound extends Error {
  message = 'Request media item or device is not found.';
}

export class UnknownType extends Error {
  message = 'Unknown library type.';
}

export class Unsupported extends Error {
  message = 'Unsupported client request.';
}

export class Unauthorized extends Error {
  message = 'Invalid username or password.';
}
