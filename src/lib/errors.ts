/** Raised when a stored project fails runtime schema validation. */
export class ProjectValidationError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[]) {
    super(message);
    this.name = "ProjectValidationError";
    this.issues = issues;
  }
}

/** Raised when the persistence layer (IndexedDB) fails. */
export class PersistenceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PersistenceError";
    this.cause = cause;
  }
}
