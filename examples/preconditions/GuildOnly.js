/**
 * GuildOnly precondition
 *
 * Blocks a command from being used in DMs.
 * Add to any command with:  preconditions: ['GuildOnly']
 *
 * This file is auto-discovered from src/preconditions/
 */

/** @type {import('trexjs').TrexPrecondition} */
const precondition = {
  name: 'GuildOnly',

  run({ interaction }) {
    if (!interaction.inGuild()) {
      return '❌ This command can only be used inside a server.';
    }
    return true;
  },
};

export default precondition;
