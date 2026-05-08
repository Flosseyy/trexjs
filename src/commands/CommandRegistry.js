/**
 * CommandRegistry
 * Stores and retrieves slash commands by name.
 */

export class CommandRegistry {
  constructor() {
    this._commands = new Map();
  }

  register(command) {
    if (!command?.data?.name) throw new Error('Command must have a data.name');
    this._commands.set(command.data.name, command);
  }

  get(name) {
    return this._commands.get(name);
  }

  getAll() {
    return [...this._commands.values()];
  }
}
