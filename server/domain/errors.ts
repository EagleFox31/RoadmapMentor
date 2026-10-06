/**
 * Business errors, independent of HTTP. `server/http/errors.ts` is the single
 * place that maps them to status codes.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The target resource does not exist or is not visible to the caller. */
export class NotFoundError extends DomainError {}

/** The request is well-formed but its business parameters are invalid. */
export class InvalidRequestError extends DomainError {}

/** The request conflicts with the current state of the resource. */
export class ConflictError extends DomainError {}
