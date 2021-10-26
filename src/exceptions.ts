export class BadRequest extends Error {
  message = 'An invalid request, generally a user error.';

  constructor(message) {
    super(message);
    this.name = 'BadRequest';
    this.message = message;
  }
}

export class NotFound extends Error {
  message = 'Request media item or device is not found.';

  constructor(message) {
    super(message);
    this.name = 'NotFound';
    this.message = message;
  }
}

export class UnknownType extends Error {
  message = 'Unknown library type.';

  constructor(message) {
    super(message);
    this.name = 'UnknownType';
    this.message = message;
  }
}

export class Unsupported extends Error {
  message = 'Unsupported client request.';

  constructor(message) {
    super(message);
    this.name = 'Unsupported';
    this.message = message;
  }
}

export class Unauthorized extends Error {
  message = 'Invalid username or password.';

  constructor(message) {
    super(message);
    this.name = 'Unauthorized';
    this.message = message;
  }
}
