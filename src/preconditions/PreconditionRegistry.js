/**
 * PreconditionRegistry
 * Named gate-checks that run before a slash command executes.
 *
 * A precondition returns:
 *   true           → allow
 *   false          → deny (generic message)
 *   "some string"  → deny with custom message
 */

export class PreconditionRegistry {
  constructor() {
    this._preconditions = new Map();
  }

  register(precondition) {
    if (!precondition?.name) throw new Error('Precondition must have a name');
    this._preconditions.set(precondition.name, precondition);
  }

  get(name) {
    return this._preconditions.get(name);
  }
}
